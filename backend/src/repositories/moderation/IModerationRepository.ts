import type { ActivityStatus } from "@prisma/client";
import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
} from "@/schemas/moderation/moderationSchemas.js";
import type {
  ModerationDecisionResponse,
  ReportedActivityItem,
} from "@/types/moderation.js";

export type ActivityModerationState = {
  id: string;
  authorId: string;
  status: ActivityStatus;
  removedByModerationAt: Date | null;
  openReportsCount: number;
};

export interface IModerationRepository {
  listReportedActivities(
    query: ListReportedActivitiesQuery,
  ): Promise<{ items: ReportedActivityItem[]; total: number }>;

  findActivityForModeration(
    activityId: string,
  ): Promise<ActivityModerationState | null>;

  createDecision(
    activityId: string,
    managerId: string,
    data: CreateModerationDecisionInput,
  ): Promise<ModerationDecisionResponse>;
}
