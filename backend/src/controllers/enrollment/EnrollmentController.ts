import type { Request, Response } from "express";
import EnrollmentService from "@/services/enrollment/EnrollmentService.js";
import type { IEnrollmentService } from "@/services/enrollment/IEnrollmentService.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import type { ListParticipantsQuery } from "@/schemas/enrollment/EnrollmentSchemas.js";
import type { ConfirmAttendanceInput } from "@/types/enrollment.js";
import type {
  ActivityPathParams,
  EnrollmentPathParams,
} from "@/schemas/common/PathParamsSchemas.js";
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

    const { activityId } = res.locals.validatedParams as ActivityPathParams;

    const { enrollment, created } = await this._enrollmentService.enroll(
      user.id,
      activityId,
    );

    res.status(created ? 201 : 200).json(enrollment);
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;

    await this._enrollmentService.cancel(user.id, activityId);

    res.status(204).send();
  }

  public async listParticipants(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const { activityId } = res.locals.validatedParams as ActivityPathParams;
    const query = res.locals.validatedQuery as ListParticipantsQuery;

    const result = await this._enrollmentService.listParticipants(
      user,
      activityId,
      query.page,
      query.limit,
    );

    // 200 even with zero enrollments — never 404 for an empty list.
    res.status(200).json(result);
  }

  public async confirmAttendance(req: Request, res: Response): Promise<void> {
    // The authenticated session identifies who confirms attendance; callers
    // cannot select that user through params, query or body.
    const user = req.user as AuthenticatedUser;

    const { enrollmentId } = res.locals.validatedParams as EnrollmentPathParams;
    const body = res.locals.validatedBody as ConfirmAttendanceInput;

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
