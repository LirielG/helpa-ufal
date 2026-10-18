import type { Request, Response } from "express";

export interface ICertificateController {
  downloadFile(req: Request, res: Response): Promise<void>;
  validate(req: Request, res: Response): Promise<void>;
}
