import { z } from "zod";
import { isValidUUID } from "@/utils/uuid.js";

function uuidParam(field: string) {
  const message = `${field} must be a valid UUID.`;
  return z.string({ error: message }).refine(isValidUUID, { message });
}

export const ActivityPathParamsSchema = z.object({
  activityId: uuidParam("activityId"),
});

export type ActivityPathParams = z.output<typeof ActivityPathParamsSchema>;

export const EnrollmentPathParamsSchema = z.object({
  enrollmentId: uuidParam("enrollmentId"),
});

export type EnrollmentPathParams = z.output<typeof EnrollmentPathParamsSchema>;

export const ReportPathParamsSchema = z.object({
  reportId: uuidParam("reportId"),
});

export type ReportPathParams = z.output<typeof ReportPathParamsSchema>;
