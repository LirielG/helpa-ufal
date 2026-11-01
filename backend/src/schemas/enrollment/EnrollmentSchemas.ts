import { z } from "zod";
import type { ConfirmAttendanceInput } from "@/types/enrollment.js";

/**
 * GET /activities/:activityId/enrollments — ?page=1&limit=10 (limit capped at 50).
 *
 * Regex-first design on purpose: zod otherwise emits one issue per failed
 * check (e.g. int AND positive), while the contract promises exactly ONE
 * error item — { field, message } — per invalid param. A single .regex()
 * (or a single .refine() after it) can only ever produce one issue per field.
 */
export const ListParticipantsQuerySchema = z.object({
  page: z
    .string()
    .regex(/^[1-9]\d*$/, "page must be a positive integer.")
    .default("1")
    .transform(Number),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "limit must be a positive integer.")
    .default("10")
    .transform(Number)
    .refine((n) => n <= 50, { message: "limit must be at most 50." }),
});

/** Post-transform shape consumed by the controller/service. */
export type ListParticipantsQuery = z.output<
  typeof ListParticipantsQuerySchema
>;

/**
 * The attended/workloadHours combination depends only on the body, so it is
 * checked here and answers 400 before any lookup. workloadHours is
 * deliberately NOT .int(): the range and the activity's ceiling depend on
 * stored data and answer 422 in the service, so a fractional value must
 * reach it.
 */
export const ConfirmAttendanceBodySchema = z
  .object({
    attended: z.boolean(),
    workloadHours: z.number().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.attended && data.workloadHours !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["workloadHours"],
        message: "workloadHours must be omitted when attended is false.",
      });
    }
    if (data.attended && data.workloadHours === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["workloadHours"],
        message: "workloadHours is required when attended is true.",
      });
    }
  })
  .transform((data): ConfirmAttendanceInput =>
    data.attended && data.workloadHours !== undefined
      ? { attended: true, workloadHours: data.workloadHours }
      : { attended: false },
  );
