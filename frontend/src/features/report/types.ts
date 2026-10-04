import type { ReportReason } from "./constants/reportReasons";

export interface CreateActivityReportRequest {
  category: ReportReason;
  description?: string;
}

export interface ActivityReportResponse {
  id: string;
  activityId: string;
  userId: string | null;
  category: ReportReason;
  description: string | null;
  createdAt: string;
}
