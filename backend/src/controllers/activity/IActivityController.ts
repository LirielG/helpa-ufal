import type { Request, Response } from "express";

export interface IActivityController {
  create(req: Request, res: Response): Promise<void>;
  list(req: Request, res: Response): Promise<void>;
  findById(req: Request, res: Response): Promise<void>;
  update(req: Request, res: Response): Promise<void>;
  updateStatus(req: Request, res: Response): Promise<void>;
  delete(req: Request, res: Response): Promise<void>;
}