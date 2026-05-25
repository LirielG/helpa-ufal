import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import type { Activity } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";


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
  ): Promise<Activity> {
    
    const now = new Date();

    if (data.startDate <= now) {
      throw new CustomError(400, "startDate must be in the future.");
    }

    if (data.endDate <= data.startDate) {
      throw new CustomError(400, "endDate must be after startDate.");
    }

    const durationDays =
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (durationDays > MAX_ACTIVITY_DURATION_DAYS) {
      throw new CustomError(400, `Activity duration cannot exceed ${MAX_ACTIVITY_DURATION_DAYS} days.`);
    }

    const daysUntilStart =
      (data.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilStart > MAX_FUTURE_START_DAYS) {
      throw new CustomError(400, `startDate cannot be more than ${MAX_FUTURE_START_DAYS} days in the future.`);
    }

    const durationHours = durationDays * 24;

    if (data.workloadHours > durationHours) {
      throw new CustomError(400, "workloadHours cannot exceed the total duration of the activity.");
    }

    if (data.workloadHours > MAX_WORKLOAD_HOURS) {
      throw new CustomError(400, `workloadHours cannot exceed ${MAX_WORKLOAD_HOURS}.`);
    }

    if (data.slots > MAX_SLOTS) {
      throw new CustomError(400, `slots cannot exceed ${MAX_SLOTS}.`);
    }

    if (data.format === "IN_PERSON" && !data.address) {
      throw new CustomError(400, "IN_PERSON activities require an address.");
    }

    if (data.format === "HYBRID" && !data.address) {
      throw new CustomError(400, "HYBRID activities require an address.");
    }

    if (data.format === "HYBRID" && !data.url) {
      throw new CustomError(400, "HYBRID activities require a url.");
    }


    return this._activityRepository.create(authorId, data);
  }
}

export default ActivityService;