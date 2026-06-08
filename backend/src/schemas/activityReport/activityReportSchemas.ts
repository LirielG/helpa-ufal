import { z } from "zod";

export const CreateActivityReportSchema = z.object({
  category: z.enum(["SPAM", "INAPPROPRIATE_CONTENT", "MISINFORMATION", "DUPLICATE", "OTHER"]),
  description: z.string().trim().min(1).max(500).nullish(),
});

export type CreateActivityReportInput = z.infer<typeof CreateActivityReportSchema>;