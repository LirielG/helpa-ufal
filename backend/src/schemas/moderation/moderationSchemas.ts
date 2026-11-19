import { z } from "zod";
import { PaginationQuerySchema } from "@/schemas/common/PaginationSchemas.js";

export const REPORTED_ACTIVITY_STATUSES = ["open", "decided"] as const;
export type ReportedActivityStatus =
  (typeof REPORTED_ACTIVITY_STATUSES)[number];

export const ListReportedActivitiesQuerySchema = PaginationQuerySchema.extend({
  status: z
    .enum(REPORTED_ACTIVITY_STATUSES, "status must be one of: open, decided.")
    .default("open"),
});

export type ListReportedActivitiesQuery = z.output<
  typeof ListReportedActivitiesQuerySchema
>;

export const MODERATION_VERDICTS = ["UPHELD", "REJECTED"] as const;

export const CreateModerationDecisionSchema = z.object({
  verdict: z.enum(MODERATION_VERDICTS),
  justification: z
    .string({ error: "justification must be a string." })
    .trim()
    .min(1, "justification must contain between 1 and 500 characters.")
    .max(500, "justification must contain between 1 and 500 characters."),
});

export type CreateModerationDecisionInput = z.output<
  typeof CreateModerationDecisionSchema
>;
