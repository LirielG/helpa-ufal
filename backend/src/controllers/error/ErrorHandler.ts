import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { env } from "@/config/env.js";

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