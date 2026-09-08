// src/services/enrollment/EnrollmentService.ts
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import type {
  EnrollmentWithActivity,
  IEnrollmentRepository,
} from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";
import type { Enrollment } from "@prisma/client";
import type {
  EnrollmentListResponse,
  EnrollmentResponse,
  EnrollmentWithActivityResponse,
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
    await this.assertUserExists(userId);

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


    const enrollment = await this._enrollmentRepository.enroll(userId, activityId);

    return this.toEnrollResponse(enrollment);
  }

  public async cancel(userId: string, activityId: string): Promise<void> {
    await this.assertUserExists(userId);

    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "activityId", message: "activityId must be a valid UUID." },
      ]);
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    await this._enrollmentRepository.cancel(userId, activityId);
  }

  public async listActiveByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<EnrollmentListResponse> {
    const skip = (page - 1) * limit;
    const { items, total } = await this._enrollmentRepository.findActiveByUserId(
      userId,
      skip,
      limit,
    );

    return {
      items: items.map((item) => this.toEnrollmentWithActivityResponse(item)),
      total,
      page,
      limit,
    };
  }

  // Token valid and user still exists
  private async assertUserExists(userId: string): Promise<void> {
    const user = await this._activityRepository.findUserById(userId);
    if (!user) {
      throw new CustomError(401, "User account not found or inactive.");
    }
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
}

export default EnrollmentService;