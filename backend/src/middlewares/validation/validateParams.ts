import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import ValidationError from "@/models/error/ValidationError.js";
import type { ValidationErrorItem } from "@/models/error/ValidationError.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";

type RequestSchemas = {
  query?: z.ZodType;
  body?: z.ZodType;
};

export function validateParams(
  schema: z.ZodType,
  schemas: RequestSchemas = {},
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const params = schema.safeParse(req.params);
    const query = schemas.query?.safeParse(req.query);
    const body = schemas.body?.safeParse(req.body);
    const errors: ValidationErrorItem[] = [];

    if (!params.success) {
      errors.push(
        ...params.error.issues.map((issue): ValidationErrorItem => ({
          field: issue.path.join("."),
          code: "INVALID_UUID",
          message: issue.message,
        })),
      );
    }

    if (query && !query.success) {
      errors.push(
        ...query.error.issues.flatMap((issue): ValidationErrorItem[] =>
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
        ),
      );
    }

    if (body && !body.success) {
      errors.push(
        ...body.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    if (errors.length > 0) {
      next(
        new ValidationError(
          errors,
          params.success && query && !query.success
            ? INVALID_QUERY_MESSAGE
            : undefined,
        ),
      );
      return;
    }

    if (params.success) res.locals.validatedParams = params.data;
    if (query?.success) res.locals.validatedQuery = query.data;
    if (body?.success) res.locals.validatedBody = body.data;
    next();
  };
}
