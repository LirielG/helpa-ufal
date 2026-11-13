import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import ValidationError from "@/models/error/ValidationError.js";
import type { ValidationErrorItem } from "@/models/error/ValidationError.js";

/**
 * Validates req.query against a Zod schema and stores the parsed (typed)
 * result in res.locals.validatedQuery.
 *
 * Protected routes authenticate before validating the query so expired
 * sessions reach the client's 401 handling even when the query is invalid.
 *
 * The message passed in becomes the body's `message` via the (now
 * configurable) ValidationError — keep it as a constant next to the schema,
 * never an inline string, so contract and code can't drift apart silently.
 */
export function validateQuery<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  message: string,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      // A strict schema reports every unknown key in a single issue at the
      // root; splitting it gives one item per parameter, named after it.
      const errors: ValidationErrorItem[] = result.error.issues.flatMap(
        (issue): ValidationErrorItem[] =>
          issue.code === "unrecognized_keys"
            ? issue.keys.map((key) => ({
                field: key,
                code: "UNKNOWN_PARAMETER",
                message: `${key} is not a supported query parameter.`,
              }))
            : [
                {
                  field: String(issue.path[0] ?? "query"),
                  message: issue.message,
                },
              ],
      );
      next(new ValidationError(errors, message));
      return;
    }

    // Express types req.query as qs.ParsedQs; the parsed output is the
    // source of truth from here on (numbers, defaults applied).
    res.locals.validatedQuery = result.data as z.output<TSchema>;
    next();
  };
}
