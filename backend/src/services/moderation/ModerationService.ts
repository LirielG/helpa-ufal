import ValidationError, {
  type ValidationErrorItem,
} from "@/models/error/ValidationError.js";
import { assertCanModerateActivity } from "@/models/moderation/moderationRules.js";
import ModerationRepository from "@/repositories/moderation/ModerationRepository.js";
import type { IModerationRepository } from "@/repositories/moderation/IModerationRepository.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";
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

function assertValidPagination(page: number, limit: number): void {
  const errors: ValidationErrorItem[] = [];

  // Number.isInteger rejects NaN, Infinity (e.g. a 310-digit page string that
  // overflows JS Number), and floats, while keeping large finite integers
  // (like 1e20) accepted so the repository can answer an empty page.
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: "page", message: "page must be a positive integer." });
  }
  if (!Number.isInteger(limit) || limit < 1) {
    errors.push({
      field: "limit",
      message: "limit must be a positive integer.",
    });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors, INVALID_QUERY_MESSAGE);
  }
}

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
    assertValidPagination(query.page, query.limit);

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

    assertCanModerateActivity(activity, managerId, data.verdict);

    return this._moderationRepository.createDecision(
      activityId,
      managerId,
      data,
    );
  }
}

export default ModerationService;
