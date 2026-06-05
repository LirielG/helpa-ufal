import { z } from "zod";
import { REPORT_REASONS } from "../constants/reportReasons";

const reportReasonValues = REPORT_REASONS.map((reason) => reason.value) as [string, ...string[]];

export const reportSchema = z.object({
  reasons: z.array(z.enum(reportReasonValues)).min(1, "Selecione ao menos um motivo"),
  details: z
    .string()
    .trim()
    .min(1, "Descreva o motivo da denúncia")
    .max(1000, "Limite de 1000 caracteres"),
});

export type ReportFormValues = z.infer<typeof reportSchema>;