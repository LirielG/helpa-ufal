import { assertCanModerateActivity } from "@/models/moderation/moderationRules.js";
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
    // repository re-runs the same assertCanModerateActivity under FOR UPDATE.
    const activity =
      await this._moderationRepository.findActivityForModeration(activityId);

    assertCanModerateActivity(
      activity,
      managerId,
      data.verdict,
      data.reportIds,
    );

    return this._moderationRepository.createDecision(
      activityId,
      managerId,
      data,
    );
  }
}

export default ModerationService;
