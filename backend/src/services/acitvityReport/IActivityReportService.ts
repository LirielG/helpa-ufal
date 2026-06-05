import { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ActivityReportResponse } from "@/types/activityReport.js";


export interface IActivityReportService {
  createReport(
    activityId: string,
    requesterId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse>;
}