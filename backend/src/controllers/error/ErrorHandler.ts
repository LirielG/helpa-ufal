import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { env } from "@/config/env.js";

// Maps a Prisma unique-constraint field name to a user-facing message.
// Deliberately a closed whitelist: any P2002 on a field NOT listed here
// falls back to a generic message instead of ever echoing the raw field
// name (which could leak internal/DB-only column names).
const UNIQUE_FIELD_MESSAGES: Record<string, string> = {
  email:            "Email already in use.",
  registrationCode: "Registration code already in use.",
  cndb:             "CNDB already in use.",
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
      status:  400,
      message: "Validation error.",
      errors:  err.issues.map((e) => ({
        field:   e.path.join("."),
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
      status:  400,
      message: err.message,
      errors:  err.errors,
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
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2002"
    ) {
      next(err);
      return;
    }

    // Prisma's P2002 shape has changed across versions/engines:
    // - Legacy (Rust query engine): `meta.target` — a field name or
    //   array of field names (e.g. ["registrationCode"]).
    // - Driver adapters (e.g. @prisma/adapter-pg): the field names
    //   instead live nested at `meta.driverAdapterError.cause.constraint
    //   .fields`, as quoted SQL identifiers (e.g. ['"registrationCode"']).
    // We read both shapes so this keeps working regardless of which one
    // this project's Prisma setup produces.
    const meta = err.meta as Record<string, unknown> | undefined;
    const driverAdapterError = meta?.driverAdapterError as
      | { cause?: { constraint?: { fields?: unknown } } }
      | undefined;

    const rawCandidates: unknown[] = [
      meta?.target,
      driverAdapterError?.cause?.constraint?.fields,
    ];

    const fields: string[] = rawCandidates.flatMap((candidate) => {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is string => typeof item === "string");
      }
      return typeof candidate === "string" ? [candidate] : [];
    });

    const knownField = Object.keys(UNIQUE_FIELD_MESSAGES).find((key) =>
      fields.some((field) => field.toLowerCase().includes(key.toLowerCase())),
    );
    const message = knownField
      ? UNIQUE_FIELD_MESSAGES[knownField]
      : "This value is already in use.";

    // Intentionally only { status, message }: no `meta`, no constraint/table
    // name, no stack — nothing here should let internal schema details leak.
    res.status(409).json({
      status:  409,
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
        status:  err.statusCode,
        message: err.message,
      });
      return;
    }

    const stack =
      env.NODE_ENV === "development" && err instanceof Error
        ? err.stack
        : undefined;

    res.status(500).json({
      status:  500,
      message: "Internal server error.",
      stack,
    });
  }
}

export default new ErrorHandler();