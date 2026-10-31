import { api } from "@/services/api";
import type { ListReportsResponse, Report } from "@/services/contracts/report";

export const REPORTS_PAGE_LIMIT = 20;

export interface FetchReportsParams {
  resolved: boolean;
  page?: number;
  limit?: number;
}

/**
 * Fetches the paginated moderation queue (`GET /reports`).
 *
 * Throws ApiError on failure — callers map the status to a pt-BR message.
 */
export async function fetchReports({
  resolved,
  page = 1,
  limit = REPORTS_PAGE_LIMIT,
}: FetchReportsParams): Promise<ListReportsResponse> {
  return api.get<ListReportsResponse>("/reports", {
    params: { resolved, page, limit },
  });
}

/**
 * Marks a report as resolved (`PUT /reports/:reportId/resolution`).
 *
 * Idempotent: repeating the call returns 200 with the original `resolvedAt`.
 * Throws ApiError on failure.
 */
export async function resolveReport(reportId: string): Promise<Report> {
  return api.put<Report>(`/reports/${reportId}/resolution`);
}
