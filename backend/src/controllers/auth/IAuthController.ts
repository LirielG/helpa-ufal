import type { Request, Response } from "express";

export interface IAuthController {
  login(req: Request, res: Response): Promise<void>;
  register(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  forgotPassword(req: Request, res: Response): Promise<void>;
  verifyResetCode(req: Request, res: Response): Promise<void>;
  resetPassword(req: Request, res: Response): Promise<void>;
}
