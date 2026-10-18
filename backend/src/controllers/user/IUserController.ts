import type { Request, Response } from "express";

export interface IUserController {
  getMe(req: Request, res: Response): Promise<void>;
  listActivities(req: Request, res: Response): Promise<void>;
}
