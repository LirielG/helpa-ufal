import {
  CreateActivityReportInput,
  ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";
import type {
  ActivityReportResponse,
  ReportResponse,
} from "@/types/activityReport.js";
import type { Paginated } from "@/types/pagination.js";

export interface IActivityReportService {
  createReport(
    activityId: string,
    requesterId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse>;
  listReports(query: ListReportsQuery): Promise<Paginated<ReportResponse>>;
  resolveReport(reportId: string, requesterId: string): Promise<ReportResponse>;
}
