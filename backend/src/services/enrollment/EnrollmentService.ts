// src/services/enrollment/EnrollmentService.ts
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import type {
  EnrollmentWithActivity,
  EnrollmentWithParticipant,
  IEnrollmentRepository,
} from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";
import type { Enrollment } from "@prisma/client";
import {
  ACTIVE_ENROLLMENT_STATUS,
  type AttendanceResponse,
  type ConfirmAttendanceInput,
  type EnrollmentListResponse,
  type EnrollmentResponse,
  type EnrollmentWithActivityResponse,
  type ParticipantResponse,
  type ParticipantsListResponse,
} from "@/types/enrollment.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * The API speaks page/limit (page is 1-based); the repository speaks skip/take.
 * This is the single place where one becomes the other, and it is also the
 * guard: whatever the caller passes (a script, a job, a test, a new service —
 * anything that does not come through the HTTP validateQuery), the repository
 * only ever receives a non-negative skip. `(0 - 1) * 10` would be -10, which
 * Prisma rejects as a 500; so would a negative limit on any page beyond the first.
 *
 * Invalid values are corrected, not rejected: page and limit are floored to
 * whole numbers and raised to at least 1; NaN/Infinity fall back to the defaults.
 * There is deliberately NO upper bound on limit here — that is its own issue.
 * The corrected page/limit are what the caller gets echoed back in the response.
 */
function toSafePagination(
  page: number,
  limit: number,
): { page: number; limit: number; skip: number } {
  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : DEFAULT_PAGE;
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : DEFAULT_LIMIT;

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

type Props = {
  enrollmentRepository?: IEnrollmentRepository;
  activityRepository?: IActivityRepository;
  userRepository?: IUserRepository;
};

class EnrollmentService implements IEnrollmentService {
  private _enrollmentRepository: IEnrollmentRepository;
  private _activityRepository: IActivityRepository;
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._enrollmentRepository =
      props?.enrollmentRepository ?? new EnrollmentRepository();
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  public async enroll(
    userId: string,
    activityId: string,
  ): Promise<EnrollmentResponse> {
    await this.requireUser(userId);

    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "activityId", message: "activityId must be a valid UUID." },
      ]);
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (activity.status !== "OPEN") {
      throw new CustomError(409, "Activity is not open for enrollment.");
    }

    const enrollment = await this._enrollmentRepository.enroll(
      userId,
      activityId,
    );

    return this.toEnrollResponse(enrollment);
  }

  public async cancel(userId: string, activityId: string): Promise<void> {
    await this.requireUser(userId);

    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "activityId", message: "activityId must be a valid UUID." },
      ]);
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (activity.status !== "OPEN") {
      throw new CustomError(409, "Activity is not open for cancellation.");
    }

    await this._enrollmentRepository.cancel(userId, activityId);
  }

  public async listActiveByUser(
    userId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<EnrollmentListResponse> {
    const pagination = toSafePagination(page, limit);
    const { items, total } =
      await this._enrollmentRepository.findActiveByUserId(
        userId,
        pagination.skip,
        pagination.limit,
      );

    return {
      items: items.map((item) => this.toEnrollmentWithActivityResponse(item)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  public async listParticipants(
    userId: string,
    activityId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<ParticipantsListResponse> {
    const user = await this.requireUser(userId);

    if (!isValidUUID(activityId)) {
      throw new CustomError(404, "Activity not found.");
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (activity.authorId !== userId && !user.isManager) {
      throw new CustomError(
        403,
        "Only the activity creator or a manager can view the enrollment list.",
      );
    }

    const pagination = toSafePagination(page, limit);
    const { items, total, totalPresent } =
      await this._enrollmentRepository.findByActivityId(
        activityId,
        pagination.skip,
        pagination.limit,
      );

    // totalPresent comes from the repository as-is: the service forwards the
    // authoritative count instead of re-deriving it from confirmedWorkloadHours.
    return {
      items: items.map((item) => this.toParticipantResponse(item)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPresent,
    };
  }

  public async confirmAttendance(
    userId: string,
    activityId: string,
    enrollmentId: string,
    input: ConfirmAttendanceInput,
  ): Promise<AttendanceResponse> {
    const user = await this.requireUser(userId);

    // A malformed id is a lookup that finds nothing, never operator input: it
    // answers the same 404 as a nonexistent or soft-deleted row, so the route
    // never reveals which ids are merely badly shaped.
    if (!isValidUUID(activityId)) {
      throw new CustomError(404, "Activity not found.");
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (!isValidUUID(enrollmentId)) {
      throw new CustomError(404, "Enrollment not found.");
    }

    const enrollment = await this._enrollmentRepository.findByIdAndActivity(
      enrollmentId,
      activityId,
    );
    if (!enrollment) {
      throw new CustomError(404, "Enrollment not found.");
    }

    // Order is the contract: existence (404) is decided before authorization
    // (403), which is decided before the business rules (409/422).
    if (activity.authorId !== userId && !user.isManager) {
      throw new CustomError(
        403,
        "Only the activity creator or a manager can confirm attendance.",
      );
    }

    if (activity.status !== "COMPLETED") {
      throw new CustomError(
        409,
        "Attendance can only be confirmed for completed activities.",
      );
    }

    if (enrollment.status !== ACTIVE_ENROLLMENT_STATUS) {
      throw new CustomError(
        409,
        "Only approved enrollments can have attendance confirmed.",
      );
    }

    // An activity with no details has no declared workload, so no amount of
    // hours can be homologated against it: the ceiling of 0 rejects them all.
    const confirmedWorkloadHours = this.resolveConfirmedHours(
      input,
      activity.details?.workloadHours ?? 0,
    );

    const updated = await this._enrollmentRepository.confirmAttendance(
      activityId,
      enrollmentId,
      input.attended,
      confirmedWorkloadHours,
    );

    return {
      attendanceConfirmed: updated.attendanceConfirmed,
      confirmedWorkloadHours: updated.confirmedWorkloadHours,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Turns the request body into the hours that will be persisted.
   * Returning a single number is what makes the invalid states
   * unrepresentable downstream: the pair is always (true, n >= 1) or (false, 0).
   */
  private resolveConfirmedHours(
    input: ConfirmAttendanceInput,
    workloadCeiling: number,
  ): number {
    if (!input.attended) {
      if (input.workloadHours !== undefined) {
        throw new CustomError(
          422,
          "workloadHours must be omitted when attended is false.",
        );
      }
      return 0;
    }

    if (input.workloadHours === undefined) {
      throw new CustomError(
        422,
        "workloadHours is required when attended is true.",
      );
    }

    if (
      !Number.isInteger(input.workloadHours) ||
      input.workloadHours < 1 ||
      input.workloadHours > workloadCeiling
    ) {
      throw new CustomError(
        422,
        "workloadHours must be an integer between 1 and the activity's workload hours.",
      );
    }

    return input.workloadHours;
  }

  // Token valid and user still exists
  private async requireUser(userId: string): Promise<{ isManager: boolean }> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new CustomError(401, "User account not found or inactive.");
    }
    return user;
  }

  private toEnrollResponse(enrollment: Enrollment): EnrollmentResponse {
    return {
      id: enrollment.id,
      activityId: enrollment.activityId,
      userId: enrollment.userId,
      createdAt: enrollment.createdAt,
    };
  }

  private toEnrollmentWithActivityResponse(
    enrollment: EnrollmentWithActivity,
  ): EnrollmentWithActivityResponse {
    return {
      id: enrollment.id,
      activityId: enrollment.activityId,
      userId: enrollment.userId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      activity: {
        id: enrollment.activity.id,
        title: enrollment.activity.title,
        type: enrollment.activity.type,
        campus: enrollment.activity.campus,
        startDate: enrollment.activity.startDate,
        endDate: enrollment.activity.endDate,
        status: enrollment.activity.status,
      },
    };
  }

  private toParticipantResponse(
    enrollment: EnrollmentWithParticipant,
  ): ParticipantResponse {
    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      fullName: enrollment.user.fullName,
      email: enrollment.user.email,
      // Field-by-field stays as a second line of defense, but the repository
      // now selects only these fields — passwordHash never leaves the database.
      registrationCode: enrollment.user.student?.registrationCode ?? null,
      status: enrollment.status,
      attendanceConfirmed: enrollment.attendanceConfirmed,
      confirmedWorkloadHours: enrollment.confirmedWorkloadHours,
    };
  }
}

export default EnrollmentService;
