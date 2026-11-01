import type { Request, Response } from "express";
import ActivityService from "@/services/activity/ActivityService.js";
import type {
  IActivityService,
  IListActivitiesFilters,
} from "@/services/activity/IActivityService.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import {
  CreateActivitySchema,
  UpdateActivitySchema,
  UpdateActivityStatusSchema,
} from "@/schemas/activity/ActivitySchemas.js";
import CustomError from "@/models/error/CustomError.js";
import { isValidUUID } from "@/utils/uuid.js";

type Props = {
  activityService?: IActivityService;
};

class ActivityController implements IActivityController {
  private _activityService: IActivityService;

  constructor(props?: Props) {
    this._activityService = props?.activityService ?? new ActivityService();
  }

  public async create(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const data = CreateActivitySchema.parse(req.body);
    const activity = await this._activityService.create(req.user.id, data);

    res.status(201).json(activity);
  }

  public async list(req: Request, res: Response): Promise<void> {
    const filters = req.query as unknown as IListActivitiesFilters;

    const result = await this._activityService.list(filters);

    res.status(200).json(result);
  }

  public async listFilters(req: Request, res: Response): Promise<void> {
    const result = await this._activityService.listFilterOptions();
    res.status(200).json(result);
  }

  public async findById(req: Request, res: Response): Promise<void> {
    const { activityId } = req.params;

    if (!activityId || Array.isArray(activityId)) {
      throw new CustomError(400, "Invalid activityId parameter.");
    }

    const activity = await this._activityService.findById(
      activityId,
      req.user?.id,
    );
    res.status(200).json(activity);
  }

  public async update(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { activityId } = req.params;

    if (!activityId || Array.isArray(activityId)) {
      throw new CustomError(400, "Invalid activityId parameter.");
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!activityId || !uuidRegex.test(activityId)) {
      throw new CustomError(
        400,
        "Invalid activityId parameter. Must be a valid UUID.",
      );
    }

    const data = UpdateActivitySchema.parse(req.body);

    const updatedActivity = await this._activityService.update(
      activityId,
      req.user,
      data,
    );

    res.status(200).json(updatedActivity);
  }

  public async updateStatus(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { activityId } = req.params;

    if (Array.isArray(activityId)) {
      throw new CustomError(400, "Invalid activityId parameter.");
    }

    if (!isValidUUID(activityId)) {
      throw new CustomError(400, "Invalid UUID format.");
    }

    const data = UpdateActivityStatusSchema.parse(req.body);

    const updatedActivity = await this._activityService.updateStatus(
      activityId,
      data.status,
      req.user,
    );

    res.status(200).json(updatedActivity);
  }

  public async delete(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { activityId } = req.params;

    if (!activityId || Array.isArray(activityId)) {
      throw new CustomError(400, "Invalid activityId parameter.");
    }

    if (!isValidUUID(activityId)) {
      throw new CustomError(400, "Invalid UUID format.");
    }

    await this._activityService.delete(activityId, req.user);

    res.status(204).send();
  }
}

export default ActivityController;
