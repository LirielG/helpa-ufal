import type { Request, Response } from "express";
import { IActivityReportService } from "@/services/acitvityReport/IActivityReportService.js";
import { IActivityReportController } from "./IActivityReportController.js";
import ActivityReportService from "@/services/acitvityReport/ActivityReportService.js";
import { CreateActivityReportSchema } from "@/schemas/activityReport/activityReportSchemas.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  activityReportService?: IActivityReportService;
};

class ActivityReportController implements IActivityReportController {
  private _activityReportService: IActivityReportService;

  constructor(props?: Props) {
    this._activityReportService =
      props?.activityReportService ?? new ActivityReportService();
  }

  public async createReport(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId))
      throw new CustomError(400, "Invalid activityId parameter.");

    const data = CreateActivityReportSchema.parse(req.body);
    const report = await this._activityReportService.createReport(
      activityId,
      req.user.id,
      data,
    );

    res.status(201).json(report);
  }
}

export default ActivityReportController;
