import { z } from "zod";
import { PaginationQuerySchema } from "@/schemas/common/PaginationSchemas.js";

export const CreateActivityReportSchema = z.object({
  category: z.enum([
    "SPAM",
    "INAPPROPRIATE_CONTENT",
    "MISINFORMATION",
    "DUPLICATE",
    "OTHER",
  ]),
  description: z.string().trim().min(1).max(500).nullish(),
});

export type CreateActivityReportInput = z.infer<
  typeof CreateActivityReportSchema
>;

export const ListReportsQuerySchema = PaginationQuerySchema.extend({
  // Open reports are the moderation queue, so they are the default listing.
  resolved: z
    .enum(["true", "false"], "resolved must be true or false.")
    .default("false")
    .transform((value) => value === "true"),
});

export type ListReportsQuery = z.output<typeof ListReportsQuerySchema>;
