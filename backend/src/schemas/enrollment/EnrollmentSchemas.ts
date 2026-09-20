import { z } from "zod";

// Contract message pinned by docs/bruno/Enrollments/List Activity Enrollments.yml
// and by tests/integration/enrollment/get-enrollments.test.ts — changing it
// here changes the public error body.
export const INVALID_QUERY_MESSAGE = "Invalid query parameters.";

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
 * workloadHours is deliberately NOT .int(): the range, the ceiling and the
 * attended/workloadHours combination are business rules and answer 422, so
 * only a wrong TYPE may fail here (400). A fractional value is a number and
 * must reach the service.
 */
export const ConfirmAttendanceBodySchema = z
  .object({
    attended: z.boolean(),
    workloadHours: z.number().optional(),
  })
  .strict();
