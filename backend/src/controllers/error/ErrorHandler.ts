import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import CustomError from "@/models/error/CustomError.js";
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

    const messages = err.issues.map((e) => e.message);
    res.status(400).json({ message: messages });
  }

  public defaultHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }

    const stack =
      env.NODE_ENV === "development" && err instanceof Error
        ? err.stack
        : undefined;

    res.status(500).json({ message: "Internal server error.", stack });
  }
}

export default new ErrorHandler();
