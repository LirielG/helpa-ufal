import { z } from "zod";
import { REPORT_REASONS, type ReportReason } from "../constants/reportReasons";

export const REPORT_DESCRIPTION_MAX_LENGTH = 500;

const reportReasonValues = REPORT_REASONS.map((reason) => reason.value) as [
  ReportReason,
  ...ReportReason[],
];

export const reportSchema = z.object({
  category: z.enum(reportReasonValues, { error: "Selecione um motivo" }),
  description: z
    .string()
    .trim()
    .max(
      REPORT_DESCRIPTION_MAX_LENGTH,
      `Limite de ${REPORT_DESCRIPTION_MAX_LENGTH} caracteres`,
    ),
});

export type ReportFormValues = z.infer<typeof reportSchema>;
