import type { Request, Response } from "express";
import EnrollmentService from "@/services/enrollment/EnrollmentService.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import {
  ConfirmAttendanceBodySchema,
  ConfirmAttendanceParamsSchema,
  type ListParticipantsQuery,
} from "@/schemas/enrollment/EnrollmentSchemas.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  enrollmentService?: IEnrollmentService;
};

class EnrollmentController implements IEnrollmentController {
  private _enrollmentService: IEnrollmentService;

  constructor(props?: Props) {
    this._enrollmentService =
      props?.enrollmentService ?? new EnrollmentService();
  }

  public async enroll(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;
    if (!id || Array.isArray(id))
      throw new CustomError(400, "Invalid id parameter.");

    const enrollment = await this._enrollmentService.enroll(req.user.id, id);

    res.status(201).json(enrollment);
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { id } = req.params;
    if (!id || Array.isArray(id))
      throw new CustomError(400, "Invalid id parameter.");

    await this._enrollmentService.cancel(req.user.id, id);

    res.status(204).send();
  }

  public async listParticipants(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId)) {
      throw new CustomError(404, "Activity not found.");
    }

    // Validated and defaulted upstream by validateQuery(ListParticipantsQuerySchema),
    // registered BEFORE auth on the route. If it is absent, page/limit arrive as
    // undefined and the service defaults apply — defaults live in exactly one
    // runtime place (the service signature), never duplicated here.
    const query = res.locals.validatedQuery as
      | ListParticipantsQuery
      | undefined;

    const result = await this._enrollmentService.listParticipants(
      req.user.id,
      activityId,
      query?.page,
      query?.limit,
    );

    // 200 even with zero enrollments — never 404 for an empty list.
    res.status(200).json(result);
  }

  public async confirmAttendance(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    // Shape first (400), business afterwards: both ids are validated here so
    // the service can treat them as real identifiers. The user is taken from
    // the token alone — params, query and body never name who homologates.
    const { activityId, enrollmentId } = ConfirmAttendanceParamsSchema.parse(
      req.params,
    );
    const body = ConfirmAttendanceBodySchema.parse(req.body);

    const attendance = await this._enrollmentService.confirmAttendance(
      req.user.id,
      activityId,
      enrollmentId,
      body,
    );

    // Always 200: a correction is not a creation, so there is no 201 here.
    res.status(200).json(attendance);
  }
}

export default EnrollmentController;
