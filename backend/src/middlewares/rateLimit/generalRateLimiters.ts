import type { Request, RequestHandler } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { env } from "@/config/env.js";
import { createRateLimiter } from "@/middlewares/rateLimit/createRateLimiter.js";
import { verifyJwt } from "@/utils/jwt.js";

type GeneralRateLimitOptions = {
  globalLimit?: number;
  anonymousLimit?: number;
  authenticatedLimit?: number;
  enabled?: boolean;
};

export function createGeneralRateLimiters({
  globalLimit = env.RATE_LIMIT_GLOBAL_PER_MINUTE,
  anonymousLimit = env.RATE_LIMIT_ANONYMOUS_PER_MINUTE,
  authenticatedLimit = env.RATE_LIMIT_AUTHENTICATED_PER_MINUTE,
  enabled = env.RATE_LIMIT_ENABLED,
}: GeneralRateLimitOptions = {}) {
  const globalRateLimiter = createRateLimiter({
    windowMs: 60_000,
    limit: globalLimit,
    enabled,
    keyGenerator: () => "instance",
    identifier: "global",
  });

  const identities = new WeakMap<Request, string>();
  const limitClient = createRateLimiter({
    windowMs: 60_000,
    limit: (req) => (identities.has(req) ? authenticatedLimit : anonymousLimit),
    enabled,
    identifier: "client",
    keyGenerator: (req) => {
      const userId = identities.get(req);
      return userId
        ? `user:${userId}`
        : `ip:${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown")}`;
    },
  });

  const clientRateLimiter: RequestHandler = (req, res, next) => {
    if (!enabled || req.method === "OPTIONS") return next();

    const token: unknown = req.cookies?.token;
    const identity = typeof token === "string" ? verifyJwt(token) : null;

    // The verified token identifies a quota only. Route authentication still
    // checks the current session and permissions in the database.
    if (typeof identity?.id === "string" && identity.id.length > 0) {
      identities.set(req, identity.id);
    }

    return limitClient(req, res, next);
  };

  return { globalRateLimiter, clientRateLimiter };
}
