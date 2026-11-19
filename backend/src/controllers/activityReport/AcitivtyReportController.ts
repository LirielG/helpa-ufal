import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import { IActivityReportService } from "@/services/acitvityReport/IActivityReportService.js";
import { IActivityReportController } from "./IActivityReportController.js";
import ActivityReportService from "@/services/acitvityReport/ActivityReportService.js";
import type { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ActivityPathParams } from "@/schemas/common/PathParamsSchemas.js";

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
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;
    const data = res.locals.validatedBody as CreateActivityReportInput;
    const report = await this._activityReportService.createReport(
      activityId,
      user.id,
      data,
    );

    res.status(201).json(report);
  }
}

export default ActivityReportController;
