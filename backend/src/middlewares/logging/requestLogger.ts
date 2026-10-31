import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (env.NODE_ENV === "test") {
    next();
    return;
  }

  const start = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - start);
    const path = (req.originalUrl ?? req.url ?? req.path ?? "").split("?")[0];
    console.log(`${req.method} ${path} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}
