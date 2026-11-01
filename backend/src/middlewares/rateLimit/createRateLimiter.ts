import { rateLimit } from "express-rate-limit";
import { env } from "@/config/env.js";
import CustomError from "@/models/error/CustomError.js";

type RateLimiterOptions = {
  windowMs: number;
  limit: number;
  enabled?: boolean;
};

export function createRateLimiter({
  windowMs,
  limit,
  enabled = env.RATE_LIMIT_ENABLED,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => !enabled,
    handler: (_req, _res, next) => {
      next(new CustomError(429, "Too many requests. Please try again later."));
    },
  });
}
