import type { IActivityReportService } from "./IActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
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
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";

type Props = {
  activityReportRepository?: IActivityReportRepository;
  activityRepository?: IActivityRepository;
};

class ActivityReportService implements IActivityReportService {
  private _reportRepository: IActivityReportRepository;
  private _activityRepository: IActivityRepository;

  constructor(props?: Props) {
    this._reportRepository =
      props?.activityReportRepository ?? new ActivityReportRepository();
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
  }

  public async createReport(
    activityId: string,
    requesterId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse> {
    if (!isValidUUID(activityId)) {
      throw new ValidationError([
        { field: "activityId", message: "activityId must be a valid UUID." },
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
    query: ListReportsQuery,
  ): Promise<Paginated<ReportResponse>> {
    const { items, total } = await this._reportRepository.list(query);

    return toPaginated(items, total, query.page, query.limit);
  }

  public async resolveReport(
    reportId: string,
    requesterId: string,
  ): Promise<ReportResponse> {
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
}

export default ActivityReportService;
