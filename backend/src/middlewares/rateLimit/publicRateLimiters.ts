import { createRateLimiter } from "@/middlewares/rateLimit/createRateLimiter.js";

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 5,
});

export const certificateValidationRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 60,
});
