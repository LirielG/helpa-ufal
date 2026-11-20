import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
} from "@/schemas/moderation/moderationSchemas.js";
import type {
  ModerationDecisionResponse,
  ReportedActivityItem,
} from "@/types/moderation.js";
import type { Paginated } from "@/types/pagination.js";

export interface IModerationService {
  listReportedActivities(
    query: ListReportedActivitiesQuery,
  ): Promise<Paginated<ReportedActivityItem>>;

  createDecision(
    activityId: string,
    managerId: string,
    data: CreateModerationDecisionInput,
  ): Promise<ModerationDecisionResponse>;
}
