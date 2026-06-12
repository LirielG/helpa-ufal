import type { Request, Response } from "express";
import ActivityService from "@/services/activity/ActivityService.js";
import type { IActivityService, IListActivitiesFilters } from "@/services/activity/IActivityService.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import { CreateActivitySchema, UpdateActivityStatusSchema } from "@/schemas/activity/ActivitySchemas.js";
import CustomError from "@/models/error/CustomError.js";


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

  public async list(req: Request, res: Response): Promise<void>{
    const userId = req.user?.id;

    const filters = req.query as unknown as IListActivitiesFilters;

    const result = await this._activityService.list(filters, userId);

    res.status(200).json(result);
  }
  
  public async findById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new CustomError(400, "Invalid id parameter.");
    }

    const activity = await this._activityService.findById(id);
    res.status(200).json(activity);
  }

  public async updateStatus(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;

    // Verificar se id é string (não array)
    if (Array.isArray(id)) {
        throw new CustomError(400, "Invalid id parameter.");
    }

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        throw new CustomError(400, "Invalid UUID format.");
    }

    const data = UpdateActivityStatusSchema.parse(req.body);
    
    const updatedActivity = await this._activityService.updateStatus(
        id,
        data.status,
        req.user.id
    );

    res.status(200).json(updatedActivity);
}
}

export default ActivityController;