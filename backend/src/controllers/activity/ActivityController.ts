import type { Request, Response } from "express";
import ActivityService from "@/services/activity/ActivityService.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import { CreateActivitySchema } from "@/schemas/activity/ActivitySchemas.js";
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
    const tipo    = req.query.tipo;
    const formato = req.query.formato;
    const status  = req.query.status;
    const search  = req.query.search;
    const page    = req.query.page;
    const limit   = req.query.limit;
    const orderBy = req.query.orderBy;
    const order   = req.query.order; 

    const usuarioId = req.user?.id;

    // TODO: implementar validações no service e as queries cm prisma 


    res.status(200).json({ //mock *temporário* para teste
      message: "Rota de listagem acessada com sucesso",
      filters: { tipo, formato, status, search, page, limit, orderBy, order }
    });
  }
}

export default ActivityController;