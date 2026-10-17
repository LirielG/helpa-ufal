import { z } from "zod";

export const INVALID_QUERY_MESSAGE = "Invalid query parameters.";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

// A single regex per field instead of chained int/positive checks: zod emits
// one issue per failed check, and the contract promises one error item per
// parameter.
function positiveInteger(field: string) {
  return z.string().regex(/^[1-9]\d*$/, `${field} must be a positive integer.`);
}

/**
 * ?page&limit shared by every paginated route. Strict, so a route extends it
 * with its own filters and an unknown parameter still answers 400.
 */
export const PaginationQuerySchema = z.strictObject({
  page: positiveInteger("page").default("1").transform(Number),
  limit: positiveInteger("limit")
    .default(String(DEFAULT_PAGE_LIMIT))
    .transform(Number)
    .refine((n) => n <= MAX_PAGE_LIMIT, {
      message: `limit must be at most ${MAX_PAGE_LIMIT}.`,
    }),
});

export type PaginationQuery = z.output<typeof PaginationQuerySchema>;
