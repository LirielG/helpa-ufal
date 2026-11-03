import { rateLimit, type Options } from "express-rate-limit";
import { env } from "@/config/env.js";
import CustomError from "@/models/error/CustomError.js";

type RateLimiterOptions = {
  windowMs: number;
  limit: Options["limit"];
  enabled?: boolean;
  keyGenerator?: Options["keyGenerator"];
  identifier?: string;
};

export function createRateLimiter({
  windowMs,
  limit,
  enabled = env.RATE_LIMIT_ENABLED,
  keyGenerator,
  identifier,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(identifier ? { identifier } : {}),
    skip: (req) => !enabled || req.method === "OPTIONS",
    handler: (_req, _res, next) => {
      next(new CustomError(429, "Too many requests. Please try again later."));
    },
  });
}
