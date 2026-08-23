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

    // Contrato: "Activity not found or soft-deleted" → 404. Como o findById
    // já filtra deletedAt no where, null cobre os dois casos — sem expor
    // a lixeira pela API.
    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    // Contrato: apenas OPEN aceita inscrição.
    // IN_PROGRESS/COMPLETED/CANCELLED (ciclo de vida) → 409.
    if (activity.status !== "OPEN") {
      throw new CustomError(409, "Activity is not open for enrollment.");
    }

    // Passamos `slots` (total) e não `availableSlots`: o count confiável é
    // refeito dentro da transação, após o lock — o valor lido aqui estaria
    // sujeito a corrida. Duplicidade e capacidade são decididas no repository.
    const enrollment = await this._enrollmentRepository.enroll(
      userId,
      activityId,
      activity.slots,
    );

    return this.toEnrollResponse(enrollment);
  }

  public async cancel(userId: string, activityId: string): Promise<void> {
    await this.assertUserExists(userId);

    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "activityId", message: "activityId must be a valid UUID." },
      ]);
    }

    // Contrato DELETE: 404 "Activity not found." (inclusive soft-deletada,
    // filtrada pelo findById) vem antes de procurar a inscrição — mesma
    // ordem de validação do POST.
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

  // Contrato: "light hybrid authentication" — token válido E usuário ainda
  // existente. O AuthMiddleware só valida o JWT; a checagem de existência
  // fica no service, seguindo o precedente de updateStatus/delete do
  // ActivityService. Quando User ganhar flag de "ativo", basta estender aqui.
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