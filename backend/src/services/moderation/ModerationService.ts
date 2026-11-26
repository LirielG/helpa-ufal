import { assertCanModerateActivity } from "@/models/moderation/moderationRules.js";
import ModerationRepository from "@/repositories/moderation/ModerationRepository.js";
import type {
  IModerationRepository,
  ModerationDecisionNotifications,
} from "@/repositories/moderation/IModerationRepository.js";
import EmailService from "@/services/email/EmailService.js";
import type { IEmailService } from "@/services/email/IEmailService.js";
import type {
  EmailTemplateCode,
  EmailTemplateVars,
} from "@/services/email/templates/index.js";
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
  emailService?: IEmailService;
};

class ModerationService implements IModerationService {
  private _moderationRepository: IModerationRepository;
  private _emailService: IEmailService;

  constructor(props?: Props) {
    this._moderationRepository =
      props?.moderationRepository ?? new ModerationRepository();
    this._emailService = props?.emailService ?? new EmailService();
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

    const { decision, notifications } =
      await this._moderationRepository.createDecision(
        activityId,
        managerId,
        data,
      );

    // Dispatched strictly after commit without blocking the HTTP response;
    // delivery failures are logged inside sendNotification and never roll back
    // the decision.
    void this.notifyDecision(decision, notifications);

    return decision;
  }

  private async notifyDecision(
    decision: ModerationDecisionResponse,
    notifications: ModerationDecisionNotifications,
  ): Promise<void> {
    const {
      activityTitle,
      authorEmail,
      reporterEmails,
      cancelledEnrolleeEmails,
    } = notifications;

    for (const email of new Set(reporterEmails)) {
      await this.sendNotification(
        email,
        "reportReviewed",
        { activityTitle, verdict: decision.verdict },
        decision.id,
      );
    }

    if (decision.verdict === "UPHELD") {
      if (authorEmail) {
        await this.sendNotification(
          authorEmail,
          "activityRemovedByModeration",
          { activityTitle, justification: decision.justification },
          decision.id,
        );
      }

      for (const email of new Set(cancelledEnrolleeEmails)) {
        await this.sendNotification(
          email,
          "enrollmentCancelledByModeration",
          { activityTitle },
          decision.id,
        );
      }
    }
  }

  private async sendNotification<K extends EmailTemplateCode>(
    to: string,
    templateCode: K,
    vars: EmailTemplateVars[K],
    decisionId: string,
  ): Promise<void> {
    try {
      await this._emailService.send(to, templateCode, vars);
    } catch (error) {
      console.error(
        `[ModerationService] Failed to send "${templateCode}" email for decision ${decisionId}:`,
        error,
      );
    }
  }
}

export default ModerationService;
