import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import type { IModerationService } from "@/services/moderation/IModerationService.js";
import ModerationService from "@/services/moderation/ModerationService.js";
import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
} from "@/schemas/moderation/moderationSchemas.js";
import type { ActivityPathParams } from "@/schemas/common/PathParamsSchemas.js";
import type { IModerationController } from "./IModerationController.js";

type Props = {
  moderationService?: IModerationService;
};

class ModerationController implements IModerationController {
  private _moderationService: IModerationService;

  constructor(props?: Props) {
    this._moderationService =
      props?.moderationService ?? new ModerationService();
  }

  public async listReportedActivities(
    _req: Request,
    res: Response,
  ): Promise<void> {
    const query = res.locals.validatedQuery as ListReportedActivitiesQuery;
    const result = await this._moderationService.listReportedActivities(query);

    res.status(200).json(result);
  }

  public async createDecision(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const { activityId } = res.locals.validatedParams as ActivityPathParams;
    const data = res.locals.validatedBody as CreateModerationDecisionInput;

    const decision = await this._moderationService.createDecision(
      activityId,
      user.id,
      data,
    );

    res.status(201).json(decision);
  }
}

export default ModerationController;
