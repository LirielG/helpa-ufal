import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { env } from "@/config/env.js";
import { uniqueViolationFields } from "@/utils/prismaErrors.js";

// Maps a Prisma unique-constraint field name to a user-facing message.
// Deliberately a closed whitelist: any P2002 on a field NOT listed here
// falls back to a generic message instead of ever echoing the raw field
// name (which could leak internal/DB-only column names).
const UNIQUE_FIELD_MESSAGES: Record<string, string> = {
  email: "Email already in use.",
  registrationCode: "Registration code already in use.",
  cndb: "CNDB already in use.",
};

class ErrorHandler {
  public zodErrorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!(err instanceof ZodError)) {
      next(err);
      return;
    }

    res.status(400).json({
      status: 400,
      message: "Validation error.",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  public validationErrorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!(err instanceof ValidationError)) {
      next(err);
      return;
    }

    res.status(400).json({
      status: 400,
      message: err.message,
      errors: err.errors,
    });
  }

  // Handles unique-constraint violations (Prisma error code P2002) that
  // bubble up from ANY repository — not just auth. Centralizing this here
  // means routes/repositories that don't exist yet are covered for free,
  // instead of every repository needing its own try/catch for P2002.
  public prismaErrorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const fields = uniqueViolationFields(err);
    if (fields === null) {
      next(err);
      return;
    }

    const knownField = Object.keys(UNIQUE_FIELD_MESSAGES).find((key) =>
      fields.some((field) => field.toLowerCase().includes(key.toLowerCase())),
    );
    const message = knownField
      ? UNIQUE_FIELD_MESSAGES[knownField]
      : "This value is already in use.";

    // Intentionally only { status, message }: no `meta`, no constraint/table
    // name, no stack — nothing here should let internal schema details leak.
    res.status(409).json({
      status: 409,
      message,
    });
  }

  public defaultHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({
        status: err.statusCode,
        message: err.message,
      });
      return;
    }

    const stack =
      env.NODE_ENV === "development" && err instanceof Error
        ? err.stack
        : undefined;

    res.status(500).json({
      status: 500,
      message: "Internal server error.",
      stack,
    });
  }
}

export default new ErrorHandler();
