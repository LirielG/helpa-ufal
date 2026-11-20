import type {
  ActivityStatus,
  ModerationVerdict,
  Prisma,
  ReportReason,
} from "@prisma/client";

export type ModerationUserSummary = {
  id: string;
  fullName: string;
};

export type ModerationReportItem = {
  id: string;
  category: ReportReason;
  description: string | null;
  createdAt: Date;
  reporter: ModerationUserSummary | null;
};

export type ModerationDecisionResponse = {
  id: string;
  verdict: ModerationVerdict;
  justification: string;
  createdAt: Date;
  decidedBy: ModerationUserSummary | null;
  reports: ModerationReportItem[];
};

export type ReportedActivitySummary = {
  id: string;
  title: string;
  status: ActivityStatus;
  authorId: string;
  removedByModerationAt: Date | null;
};

export type ReportedActivityItem = {
  activity: ReportedActivitySummary;
  openReports: ModerationReportItem[];
  decisions: ModerationDecisionResponse[];
};

// Narrow selects keep passwordHash and email out of Prisma rows so they
// cannot leak even if a mapper were ever replaced by a spread.
const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
} satisfies Prisma.UserSelect;

export const MODERATION_REPORT_SELECT = {
  id: true,
  category: true,
  description: true,
  createdAt: true,
  user: { select: USER_SUMMARY_SELECT },
} satisfies Prisma.ActivityReportSelect;

export const MODERATION_DECISION_SELECT = {
  id: true,
  verdict: true,
  justification: true,
  createdAt: true,
  decidedBy: { select: USER_SUMMARY_SELECT },
  reports: {
    select: MODERATION_REPORT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.ModerationDecisionSelect;

export const REPORTED_ACTIVITY_SELECT = {
  id: true,
  title: true,
  status: true,
  authorId: true,
  removedByModerationAt: true,
  activityReports: {
    where: { decisionId: null },
    select: MODERATION_REPORT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  },
  moderationDecisions: {
    select: MODERATION_DECISION_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.ActivitySelect;

export type ModerationReportRow = Prisma.ActivityReportGetPayload<{
  select: typeof MODERATION_REPORT_SELECT;
}>;

export type ModerationDecisionRow = Prisma.ModerationDecisionGetPayload<{
  select: typeof MODERATION_DECISION_SELECT;
}>;

export type ReportedActivityRow = Prisma.ActivityGetPayload<{
  select: typeof REPORTED_ACTIVITY_SELECT;
}>;

export function toModerationReportItem(
  report: ModerationReportRow,
): ModerationReportItem {
  return {
    id: report.id,
    category: report.category,
    description: report.description,
    createdAt: report.createdAt,
    reporter: report.user
      ? { id: report.user.id, fullName: report.user.fullName }
      : null,
  };
}

export function toModerationDecisionResponse(
  decision: ModerationDecisionRow,
): ModerationDecisionResponse {
  return {
    id: decision.id,
    verdict: decision.verdict,
    justification: decision.justification,
    createdAt: decision.createdAt,
    decidedBy: decision.decidedBy
      ? { id: decision.decidedBy.id, fullName: decision.decidedBy.fullName }
      : null,
    reports: decision.reports.map(toModerationReportItem),
  };
}

export function toReportedActivityItem(
  activity: ReportedActivityRow,
): ReportedActivityItem {
  return {
    activity: {
      id: activity.id,
      title: activity.title,
      status: activity.status,
      authorId: activity.authorId,
      removedByModerationAt: activity.removedByModerationAt,
    },
    openReports: activity.activityReports.map(toModerationReportItem),
    decisions: activity.moderationDecisions.map(toModerationDecisionResponse),
  };
}
