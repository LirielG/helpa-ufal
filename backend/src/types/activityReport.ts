import type { ActivityReport, ReportReason } from "@prisma/client";

export type ActivityReportResponse = {
  id: string;
  activityId: string;
  userId: string | null;
  category: ReportReason;
  description: string | null;
  createdAt: Date;
};

export function toActivityReportResponse(report: ActivityReport): ActivityReportResponse {
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