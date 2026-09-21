import type { Request, Response } from "express";

export interface IEnrollmentController {
  enroll(req: Request, res: Response): Promise<void>;
  cancel(req: Request, res: Response): Promise<void>;
  listParticipants(req: Request, res: Response): Promise<void>;
  confirmAttendance(req: Request, res: Response): Promise<void>;
}
