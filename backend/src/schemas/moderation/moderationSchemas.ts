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

export const CreateModerationDecisionSchema = z.strictObject(
  {
    verdict: z.enum(MODERATION_VERDICTS),
    justification: z
      .string({ error: "justification must be a string." })
      .trim()
      .min(1, "justification must contain between 1 and 500 characters.")
      .max(500, "justification must contain between 1 and 500 characters."),
    reportIds: z
      .array(z.uuid("reportIds must contain valid UUIDs."), {
        error: "reportIds must be an array of UUIDs.",
      })
      .min(1, "reportIds must contain at least one report ID."),
  },
  { error: "Request body must be a JSON object." },
);

export type CreateModerationDecisionInput = z.output<
  typeof CreateModerationDecisionSchema
>;
