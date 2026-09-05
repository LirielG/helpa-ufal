import type { Request, Response } from "express";

export interface IEnrollmentController {
  enroll(req: Request, res: Response): Promise<void>;
}
