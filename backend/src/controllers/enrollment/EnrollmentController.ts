import type { Request, Response } from "express";
import EnrollmentService from "@/services/enrollment/EnrollmentService.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import {
  ConfirmAttendanceBodySchema,
  type ListParticipantsQuery,
} from "@/schemas/enrollment/EnrollmentSchemas.js";
import CustomError from "@/models/error/CustomError.js";
import type { AuthenticatedUser } from "@/types/auth.js";

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
    const user = req.user as AuthenticatedUser;

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId))
      throw new CustomError(400, "Invalid activityId parameter.");

    const enrollment = await this._enrollmentService.enroll(
      user.id,
      activityId,
    );

    res.status(201).json(enrollment);
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId))
      throw new CustomError(400, "Invalid activityId parameter.");

    await this._enrollmentService.cancel(user.id, activityId);

    res.status(204).send();
  }

  public async listParticipants(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = req.params;
    if (!activityId || Array.isArray(activityId)) {
      throw new CustomError(404, "Activity not found.");
    }

    // Validated and defaulted upstream by validateQuery(ListParticipantsQuerySchema),
    // after authentication on the route. If it is absent, page/limit arrive as
    // undefined and the service defaults apply — defaults live in exactly one
    // runtime place (the service signature), never duplicated here.
    const query = res.locals.validatedQuery as
      ListParticipantsQuery | undefined;

    const result = await this._enrollmentService.listParticipants(
      user,
      activityId,
      query?.page,
      query?.limit,
    );

    // 200 even with zero enrollments — never 404 for an empty list.
    res.status(200).json(result);
  }

  public async confirmAttendance(req: Request, res: Response): Promise<void> {
    // The authenticated session identifies who confirms attendance; callers
    // cannot select that user through params, query or body.
    const user = req.user as AuthenticatedUser;

    const { enrollmentId } = req.params;
    if (!enrollmentId || Array.isArray(enrollmentId)) {
      throw new CustomError(404, "Enrollment not found.");
    }

    const body = ConfirmAttendanceBodySchema.parse(req.body);

    const enrollment = await this._enrollmentService.confirmAttendance(
      user,
      enrollmentId,
      body,
    );

    // Always 200: a correction is not a creation, so there is no 201 here.
    res.status(200).json(enrollment);
  }
}

export default EnrollmentController;
