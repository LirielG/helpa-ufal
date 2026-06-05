import type { Request, Response } from "express";

export interface IActivityReportController {
  createReport(req: Request, res: Response): Promise<void>;
}