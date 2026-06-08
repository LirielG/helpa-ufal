import type { IActivityReportService } from "./IActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ActivityReportResponse } from "@/types/activityReport.js";
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
    this._reportRepository = props?.activityReportRepository ?? new ActivityReportRepository();
    this._activityRepository = props?.activityRepository ?? new ActivityRepository();
  }

  public async createReport(
    activityId: string,
    requesterId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse> {


    if (!isValidUUID(activityId)) {
    throw new ValidationError([{ field: "id", message: "id must be a valid UUID." }]);
    }

    const activity = await this._activityRepository.findById(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    if (activity.authorId === requesterId) {
      throw new CustomError(403, "Activity authors cannot report their own activity.");
    }

    const existing = await this._reportRepository.findByUserAndActivity(requesterId, activityId);
    if (existing) {
      throw new CustomError(409, "You have already reported this activity.");
    }

    return this._reportRepository.create(activityId, requesterId, data);
  }
}

export default ActivityReportService;