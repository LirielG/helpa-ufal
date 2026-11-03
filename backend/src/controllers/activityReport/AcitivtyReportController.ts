import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import { IActivityReportService } from "@/services/acitvityReport/IActivityReportService.js";
import { IActivityReportController } from "./IActivityReportController.js";
import ActivityReportService from "@/services/acitvityReport/ActivityReportService.js";
import {
  CreateActivityReportSchema,
  type ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";
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
    const user = req.user as AuthenticatedUser;

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId))
      throw new CustomError(400, "Invalid activityId parameter.");

    const data = CreateActivityReportSchema.parse(req.body);
    const report = await this._activityReportService.createReport(
      activityId,
      user.id,
      data,
    );

    res.status(201).json(report);
  }

  public async listReports(req: Request, res: Response): Promise<void> {
    // Parsed and defaulted by validateQuery(ListReportsQuerySchema) on the route.
    const query = res.locals.validatedQuery as ListReportsQuery;
    const result = await this._activityReportService.listReports(query);

    // 200 even when there is nothing to moderate — never 404 for an empty list.
    res.status(200).json(result);
  }

  public async resolveReport(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const report = await this._activityReportService.resolveReport(
      req.params.reportId as string,
      user.id,
    );

    res.status(200).json(report);
  }
}

export default ActivityReportController;
