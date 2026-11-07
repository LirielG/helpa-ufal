import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import { IActivityReportService } from "@/services/acitvityReport/IActivityReportService.js";
import { IActivityReportController } from "./IActivityReportController.js";
import ActivityReportService from "@/services/acitvityReport/ActivityReportService.js";
import type {
  CreateActivityReportInput,
  ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";
import type {
  ActivityPathParams,
  ReportPathParams,
} from "@/schemas/common/PathParamsSchemas.js";

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

  public async listReports(req: Request, res: Response): Promise<void> {
    // Parsed and defaulted by validateQuery(ListReportsQuerySchema) on the route.
    const query = res.locals.validatedQuery as ListReportsQuery;
    const result = await this._activityReportService.listReports(query);

    // 200 even when there is nothing to moderate — never 404 for an empty list.
    res.status(200).json(result);
  }

  public async resolveReport(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const { reportId } = res.locals.validatedParams as ReportPathParams;

    const report = await this._activityReportService.resolveReport(
      reportId,
      user.id,
    );

    res.status(200).json(report);
  }
}

export default ActivityReportController;
