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
    if (!id || Array.isArray(id)) throw new CustomError(400, "Invalid id parameter.");

    // userId comes exclusively from the JWT (never from params/query/body).
    // UUID format, activity existence, and business rules (open status,
    // duplicity, capacity) are all validated inside the service, in the
    // order required by the contract: 401 -> 400 -> 404 -> 409.
    const enrollment = await this._enrollmentService.enroll(req.user.id, id);

    res.status(201).json(enrollment);
  }
}

export default EnrollmentController;
