import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { createRateLimiter } from "@/middlewares/rateLimit/createRateLimiter.js";

function clientIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

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

export const forgotPasswordIpRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  identifier: "forgot-password-ip",
});

// Counts every address, with or without an account, so the limit does not
// reveal which e-mails exist. It shields the victim's inbox from spam and
// the provider's daily quota from being spent on one address.
export const forgotPasswordEmailRateLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 3,
  identifier: "forgot-password-email",
  keyGenerator: (req) => {
    const email: unknown = req.body?.email;
    return typeof email === "string"
      ? `email:${email.trim().toLowerCase()}`
      : clientIp(req);
  },
});

export const verifyResetCodeRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  identifier: "verify-reset-code",
});

export const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  identifier: "reset-password",
});
