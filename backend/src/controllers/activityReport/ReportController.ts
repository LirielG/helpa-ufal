import type { Request, Response } from "express";
import CustomError from "@/models/error/CustomError.js";
import { ReportService } from "@/services/acitvityReport/ReportServices.js";
import { ListReportsQuerySchema } from "@/schemas/activityReport/ReportSchemas.js";

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  public async list(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const query = ListReportsQuerySchema.parse(req.query);
    const result = await this.reportService.list(query, req.user.id);

    res.status(200).json(result);
  }

  public async resolve(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new CustomError(400, "Invalid id parameter.");
    }

    const result = await this.reportService.resolve(id, req.user.id);

    res.status(200).json(result);
  }
}