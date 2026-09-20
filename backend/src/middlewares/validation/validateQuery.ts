import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import ValidationError from "@/models/error/ValidationError.js";
import type { ValidationErrorItem } from "@/models/error/ValidationError.js";

/**
 * Validates req.query against a Zod schema and stores the parsed (typed)
 * result in res.locals.validatedQuery.
 *
 * Register this BEFORE auth() on routes whose contract puts query format
 * first in the validation chain (400 -> 401 -> 404 -> 403): the response
 * carries no business information, only the offending field and message.
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
      const errors: ValidationErrorItem[] = result.error.issues.map(
        (issue) => ({
          field: String(issue.path[0] ?? "query"),
          message: issue.message,
        }),
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
