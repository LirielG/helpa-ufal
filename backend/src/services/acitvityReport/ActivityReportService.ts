import type { IActivityReportService } from "./IActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import {
  CreateActivityReportInput,
  ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";
import type {
  ActivityReportResponse,
  ReportResponse,
} from "@/types/activityReport.js";
import { type Paginated, toPaginated } from "@/types/pagination.js";
import ActivityReportRepository from "@/repositories/activityReport/ActivityReportRepository.js";
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";

type Props = {
  activityReportRepository?: IActivityReportRepository;
  activityRepository?: IActivityRepository;
  userRepository?: IUserRepository;
};

class ActivityReportService implements IActivityReportService {
  private _reportRepository: IActivityReportRepository;
  private _activityRepository: IActivityRepository;
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._reportRepository =
      props?.activityReportRepository ?? new ActivityReportRepository();
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  public async createReport(
    activityId: string,
    requesterId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse> {
    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "id", message: "id must be a valid UUID." },
      ]);
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (activity.authorId === requesterId) {
      throw new CustomError(
        403,
        "Activity authors cannot report their own activity.",
      );
    }

    const existing = await this._reportRepository.findByUserAndActivity(
      requesterId,
      activityId,
    );
    if (existing) {
      throw new CustomError(409, "You have already reported this activity.");
    }

    return this._reportRepository.create(activityId, requesterId, data);
  }

  public async listReports(
    requesterId: string,
    query: ListReportsQuery,
  ): Promise<Paginated<ReportResponse>> {
    await this.requireManager(requesterId);

    const { items, total } = await this._reportRepository.list(query);

    return toPaginated(items, total, query.page, query.limit);
  }

  public async resolveReport(
    reportId: string,
    requesterId: string,
  ): Promise<ReportResponse> {
    await this.requireManager(requesterId);

    if (!isValidUUID(reportId)) {
      throw new ValidationError([
        {
          field: "reportId",
          code: "INVALID_UUID",
          message: "reportId must be a valid UUID.",
        },
      ]);
    }

    const report = await this._reportRepository.findById(reportId);
    if (!report) {
      throw new CustomError(404, "Report not found.");
    }

    // Idempotent: an already resolved report comes back as it is, so the
    // first resolver and the original resolvedAt stay on record.
    if (report.resolvedAt) return report;

    const resolved = await this._reportRepository.resolve(
      reportId,
      requesterId,
    );
    // The activity can be hard-deleted between the read and the write, and
    // the cascade takes its reports with it.
    if (!resolved) {
      throw new CustomError(404, "Report not found.");
    }

    return resolved;
  }

  // auth({ manager: true }) only trusts the token claims. A token outlives a
  // removed account or a revoked manager role, so the database has the last
  // word on both.
  private async requireManager(userId: string): Promise<void> {
    const user = await this._userRepository.findById(userId);
    if (!user) {
      throw new CustomError(401, "User account not found or inactive.");
    }
    if (!user.isManager) {
      throw new CustomError(403, "User is not a manager.");
    }
  }
}

export default ActivityReportService;
