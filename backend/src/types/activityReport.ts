import type { ActivityReport, Prisma, ReportReason } from "@prisma/client";

export type ActivityReportResponse = {
  id: string;
  activityId: string;
  userId: string | null;
  category: ReportReason;
  description: string | null;
  createdAt: Date;
};

export function toActivityReportResponse(
  report: ActivityReport,
): ActivityReportResponse {
  return {
    id: report.id,
    activityId: report.activityId,
    userId: report.userId,
    category: report.category,
    description: report.description,
    createdAt: report.createdAt,
    // resolvedAt e resolvedById omitidos até Sprint 5
  };
}

// Narrow selects keep passwordHash and email out of the Prisma row itself, so
// they cannot leak even if the mapper below were ever replaced by a spread.
export const REPORT_RESPONSE_INCLUDE = {
  activity: { select: { id: true, title: true, authorId: true } },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.ActivityReportInclude;

export type ActivityReportWithRelations = Prisma.ActivityReportGetPayload<{
  include: typeof REPORT_RESPONSE_INCLUDE;
}>;

/** A report as the moderation routes (GET /reports and its resolution) expose it. */
export type ReportResponse = {
  id: string;
  category: ReportReason;
  description: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  // Soft-deleted activities are still returned: removing an activity from the
  // feed does not close the reports filed against it.
  activity: { id: string; title: string; authorId: string };
  // null when the reporter's account was removed (onDelete: SetNull).
  reporter: { id: string; fullName: string } | null;
};

export function toReportResponse(
  report: ActivityReportWithRelations,
): ReportResponse {
  return {
    id: report.id,
    category: report.category,
    description: report.description,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    activity: {
      id: report.activity.id,
      title: report.activity.title,
      authorId: report.activity.authorId,
    },
    reporter: report.user
      ? { id: report.user.id, fullName: report.user.fullName }
      : null,
  };
}
