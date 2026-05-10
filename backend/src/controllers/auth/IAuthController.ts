import type { Request, Response } from "express";

export interface IAuthController {
  login(req: Request, res: Response): Promise<void>;
  register(req: Request, res: Response): Promise<void>
}
