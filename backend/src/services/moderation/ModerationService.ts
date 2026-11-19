import CustomError from "@/models/error/CustomError.js";
import ModerationRepository from "@/repositories/moderation/ModerationRepository.js";
import type { IModerationRepository } from "@/repositories/moderation/IModerationRepository.js";
import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
} from "@/schemas/moderation/moderationSchemas.js";
import type {
  ModerationDecisionResponse,
  ReportedActivityItem,
} from "@/types/moderation.js";
import { type Paginated, toPaginated } from "@/types/pagination.js";
import type { IModerationService } from "./IModerationService.js";

type Props = {
  moderationRepository?: IModerationRepository;
};

class ModerationService implements IModerationService {
  private _moderationRepository: IModerationRepository;

  constructor(props?: Props) {
    this._moderationRepository =
      props?.moderationRepository ?? new ModerationRepository();
  }

  public async listReportedActivities(
    query: ListReportedActivitiesQuery,
  ): Promise<Paginated<ReportedActivityItem>> {
    const { items, total } =
      await this._moderationRepository.listReportedActivities(query);

    return toPaginated(items, total, query.page, query.limit);
  }

  public async createDecision(
    activityId: string,
    managerId: string,
    data: CreateModerationDecisionInput,
  ): Promise<ModerationDecisionResponse> {
    // Fast-path checks fail before acquiring the Activity row lock. The
    // repository re-validates every rule under SELECT ... FOR UPDATE.
    const activity =
      await this._moderationRepository.findActivityForModeration(activityId);
    if (!activity) {
      throw new CustomError(404, "Activity not found.", {
        code: "ACTIVITY_NOT_FOUND",
      });
    }

    if (activity.authorId === managerId) {
      throw new CustomError(
        403,
        "Activity authors cannot moderate their own activity.",
      );
    }

    if (activity.openReportsCount === 0) {
      throw new CustomError(409, "Activity has no open reports.", {
        code: "NO_OPEN_REPORTS",
      });
    }

    if (data.verdict === "UPHELD" && activity.status === "COMPLETED") {
      throw new CustomError(
        409,
        "Completed activities cannot be removed by moderation.",
        { code: "ACTIVITY_COMPLETED" },
      );
    }

    return this._moderationRepository.createDecision(
      activityId,
      managerId,
      data,
    );
  }
}

export default ModerationService;
