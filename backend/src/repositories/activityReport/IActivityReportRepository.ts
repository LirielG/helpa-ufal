import {
  CreateActivityReportInput,
  ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";
import type {
  ActivityReportResponse,
  ReportResponse,
} from "@/types/activityReport.js";

export interface IActivityReportRepository {
  create(
    activityId: string,
    userId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse>;
  findByUserAndActivity(
    userId: string,
    activityId: string,
  ): Promise<ActivityReportResponse | null>;
  list(
    filters: ListReportsQuery,
  ): Promise<{ items: ReportResponse[]; total: number }>;
  findById(id: string): Promise<ReportResponse | null>;
  resolve(id: string, resolverId: string): Promise<ReportResponse | null>;
}
