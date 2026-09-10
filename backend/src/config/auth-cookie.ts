// src/config/auth-cookie.ts
// Issue #166 — single source of truth for the session cookie options.
// The base object is shared between writing (login) and clearing (logout):
// it NEVER carries maxAge/expires, because clearCookie cannot receive them.
// maxAge is derived from JWT_EXPIRES_IN with the same parser (ms) that
// jsonwebtoken uses internally, and is applied only when writing the cookie.
import ms from "ms";
import type { CookieOptions } from "express";
import { env } from "@/config/env.js";

type AuthCookieConfig = {
  nodeEnv: "development" | "test" | "production";
  sameSite: "strict" | "lax" | "none";
};

export function buildAuthCookieOptions(
  config: AuthCookieConfig,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.sameSite,
  };
}

export function deriveCookieMaxAge(jwtExpiresIn: string): number {
  // env only guarantees a string, while ms() narrows its input to a template
  // literal type. The cast mirrors signJwt, and the guard below is what
  // actually validates the value at runtime.
  const maxAge = ms(jwtExpiresIn as ms.StringValue);

  // Fail-fast: an invalid JWT_EXPIRES_IN must not silently become a session
  // cookie — same philosophy as EnvSchema (fail at boot).
  if (typeof maxAge !== "number" || !Number.isFinite(maxAge) || maxAge <= 0) {
    throw new Error(`Invalid JWT_EXPIRES_IN: "${jwtExpiresIn}".`);
  }

  return maxAge;
}

export const authCookieOptions: CookieOptions = buildAuthCookieOptions({
  nodeEnv: env.NODE_ENV,
  sameSite: env.COOKIE_SAME_SITE,
});

export const authCookieMaxAge: number = deriveCookieMaxAge(env.JWT_EXPIRES_IN);
