import type { Request, Response } from "express";

export interface IModerationController {
  listReportedActivities(req: Request, res: Response): Promise<void>;
  createDecision(req: Request, res: Response): Promise<void>;
}
