import type { Request, Response } from "express";

export interface ISigaaActivityController {
  list(req: Request, res: Response): Promise<void>;
  listFilters(req: Request, res: Response): Promise<void>;
}
