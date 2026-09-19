// src/services/enrollment/EnrollmentService.ts
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
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

type Props = {
  enrollmentRepository?: IEnrollmentRepository;
  activityRepository?: IActivityRepository;
};

class EnrollmentService implements IEnrollmentService {
  private _enrollmentRepository: IEnrollmentRepository;
  private _activityRepository: IActivityRepository;

  constructor(props?: Props) {
    this._enrollmentRepository =
      props?.enrollmentRepository ?? new EnrollmentRepository();
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
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
    page = 1,
    limit = 10,
  ): Promise<EnrollmentListResponse> {
    const skip = (page - 1) * limit;
    const { items, total } =
      await this._enrollmentRepository.findActiveByUserId(userId, skip, limit);

    return {
      items: items.map((item) => this.toEnrollmentWithActivityResponse(item)),
      total,
      page,
      limit,
    };
  }

  public async listParticipants(
    userId: string,
    activityId: string,
    page = 1,
    limit = 10,
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

    const { items, total, totalPresent } =
      await this._enrollmentRepository.findByActivityId(
        activityId,
        page,
        limit,
      );

    // totalPresent comes from the repository as-is: the service forwards the
    // authoritative count instead of re-deriving it from confirmedWorkloadHours.
    return {
      items: items.map((item) => this.toParticipantResponse(item)),
      total,
      page,
      limit,
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

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
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
    const user = await this._activityRepository.findUserById(userId);
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
