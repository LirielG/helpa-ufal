import type { Request, Response } from "express";
import ActivityService from "@/services/activity/ActivityService.js";
import type {
  IActivityService,
  IListActivitiesFilters,
} from "@/services/activity/IActivityService.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import {
  CreateActivitySchema,
  type UpdateActivityInput,
  type UpdateActivityStatusInput,
} from "@/schemas/activity/ActivitySchemas.js";
import type { AuthenticatedUser } from "@/types/auth.js";
import type { ActivityPathParams } from "@/schemas/common/PathParamsSchemas.js";

type Props = {
  activityService?: IActivityService;
};

class ActivityController implements IActivityController {
  private _activityService: IActivityService;

  constructor(props?: Props) {
    this._activityService = props?.activityService ?? new ActivityService();
  }

  public async create(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const data = CreateActivitySchema.parse(req.body);
    const activity = await this._activityService.create(user.id, data);

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
    const { activityId } = res.locals.validatedParams as ActivityPathParams;

    const activity = await this._activityService.findById(
      activityId,
      req.user?.id,
    );
    res.status(200).json(activity);
  }

  public async update(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;
    const data = res.locals.validatedBody as UpdateActivityInput;

    const updatedActivity = await this._activityService.update(
      activityId,
      user,
      data,
    );

    res.status(200).json(updatedActivity);
  }

  public async updateStatus(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;
    const data = res.locals.validatedBody as UpdateActivityStatusInput;

    const updatedActivity = await this._activityService.updateStatus(
      activityId,
      data.status,
      user,
    );

    res.status(200).json(updatedActivity);
  }

  public async delete(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;

    await this._activityService.delete(activityId, user);

    res.status(204).send();
  }
}

export default ActivityController;
