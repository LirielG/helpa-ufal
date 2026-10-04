import { api } from "@/services/api";
import type {
  ActivityReportResponse,
  CreateActivityReportRequest,
} from "./types";

export function reportAction(
  actionId: string,
  body: CreateActivityReportRequest,
): Promise<ActivityReportResponse> {
  return api.post<ActivityReportResponse>(
    `/activities/${actionId}/reports`,
    body,
  );
}
