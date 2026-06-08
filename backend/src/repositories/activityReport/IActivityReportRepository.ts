import { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ActivityReportResponse } from "@/types/activityReport.js";


export interface IActivityReportRepository {
  create(activityId: string, userId: string, data: CreateActivityReportInput): Promise<ActivityReportResponse>;
  findByUserAndActivity(userId: string, activityId: string): Promise<ActivityReportResponse | null>;
  // metodo resolve p ser add futuramente
}