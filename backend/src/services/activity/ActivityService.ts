import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import type { Activity } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";
import { activityResponse } from "@/types/activity.js";
import ValidationError, { ValidationErrorItem } from "@/models/error/ValidationError.js";


const MAX_ACTIVITY_DURATION_DAYS = 365; // 1 years
const MAX_SLOTS                  = 10_000;
const MAX_WORKLOAD_HOURS         = 8_760; // hours in a year
const MAX_FUTURE_START_DAYS      = 365;   // 1 years ahead

type Props = {
  activityRepository?: IActivityRepository;
};

class ActivityService implements IActivityService {
  private _activityRepository: IActivityRepository;

  constructor(props?: Props) {
    this._activityRepository = props?.activityRepository ?? new ActivityRepository();
  }

  public async create(
    authorId: string,
    data: CreateActivityInput,
  ): Promise<activityResponse> {
    
    const now = new Date();
    const durationDays =
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysUntilStart =
      (data.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const durationHours = durationDays * 24;
    
    const dateErrors = [];

    if (data.startDate <= now) {
      dateErrors.push({
        "field": "startDate",
        "message": "startDate must be in the future.",
      } as ValidationErrorItem )
    }

    if (data.endDate <= data.startDate) {
      dateErrors.push({
        "field": "endDate",
        "message": "endDate must be after startDate.",
      } as ValidationErrorItem )
    }


    if (durationDays > MAX_ACTIVITY_DURATION_DAYS) {
      dateErrors.push({
        "field": "endDate",
        "message": `Activity duration cannot exceed ${MAX_ACTIVITY_DURATION_DAYS} days.`,
      } as ValidationErrorItem )
    }


    if (daysUntilStart > MAX_FUTURE_START_DAYS) {
      dateErrors.push({
        "field": "startDate",
        "message": `startDate cannot be more than ${MAX_FUTURE_START_DAYS} days in the future.`,
      } as ValidationErrorItem )
    }

    if (dateErrors.length > 0) throw new ValidationError(dateErrors);

    const capacityErrors = [];

    if (data.workloadHours > durationHours)
    capacityErrors.push({ field: "workloadHours", message: "workloadHours cannot exceed the total duration of the activity." });

    if (data.workloadHours > MAX_WORKLOAD_HOURS)
    capacityErrors.push({ field: "workloadHours", message: `workloadHours cannot exceed ${MAX_WORKLOAD_HOURS}.` });

    if (data.slots > MAX_SLOTS)
    capacityErrors.push({ field: "slots", message: `slots cannot exceed ${MAX_SLOTS}.` });

    if (capacityErrors.length > 0) throw new ValidationError(capacityErrors);


    if (data.format === "IN_PERSON" && !data.address) {
      throw new CustomError(400, "IN_PERSON activities require an address.");
    }

    if (data.format === "HYBRID" && !data.address) {
      throw new CustomError(400, "HYBRID activities require an address.");
    }

    if (data.format === "HYBRID" && !data.url) {
      throw new CustomError(400, "HYBRID activities require a url.");
    }
    
    const newActivity = await this._activityRepository.create(authorId, data);

    const activityResponse: activityResponse = {
      "id": newActivity.id,
      "authorId": newActivity.authorId,
      "title": newActivity.title,
      "type": newActivity.type,
      "campus": newActivity.campus,
      "startDate": newActivity.startDate,
      "endDate": newActivity.endDate,
      "slots": newActivity.slots,
      "status": newActivity.status,
    }
    
    return activityResponse;
  }
}

export default ActivityService;