import type { Request, Response } from "express";

export interface ISigaaActivityController {
  list(req: Request, res: Response): Promise<void>;
  listDepartments(req: Request, res: Response): Promise<void>;
}
