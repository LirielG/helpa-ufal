import { z } from "zod";
import { PaginationQuerySchema } from "@/schemas/common/PaginationSchemas.js";
import type { ConfirmAttendanceInput } from "@/types/enrollment.js";

export const ListParticipantsQuerySchema = PaginationQuerySchema.strip();

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
