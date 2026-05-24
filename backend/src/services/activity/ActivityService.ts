import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import type { Activity } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";

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
    if (data.startDate < new Date()) {
      throw new CustomError(400, "startDate must be in the future.");
    }

    return this._activityRepository.create(authorId, data);
  }
}

export default ActivityService;