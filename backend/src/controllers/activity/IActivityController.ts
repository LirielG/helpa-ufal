import type { Request, Response } from "express";

export interface IActivityController {
  create(req: Request, res: Response): Promise<void>;
  // prox metodos
  list(req: Request, res: Response): Promise<void>;
  findById(req: Request, res: Response): Promise<void>;

}