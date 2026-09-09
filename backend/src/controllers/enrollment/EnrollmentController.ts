import type { Request, Response } from "express";
import EnrollmentService from "@/services/enrollment/EnrollmentService.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  enrollmentService?: IEnrollmentService;
};

class EnrollmentController implements IEnrollmentController {
  private _enrollmentService: IEnrollmentService;

  constructor(props?: Props) {
    this._enrollmentService = props?.enrollmentService ?? new EnrollmentService();
  }

  public async enroll(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;

    const enrollment = await this._enrollmentService.enroll(req.user.id, id);

    res.status(201).json(enrollment);
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;
    if (!id || Array.isArray(id)) throw new CustomError(400, "Invalid id parameter.");

    await this._enrollmentService.cancel(req.user.id, id);

    res.status(204).send();
  }
}

export default EnrollmentController;
