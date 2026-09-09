// src/config/auth-cookie.ts
// Issue #166 — fonte única das opções do cookie de sessão.
// O objeto base é compartilhado entre a escrita (login) e a limpeza (logout):
// ele NUNCA carrega maxAge/expires, porque o clearCookie não pode recebê-los.
// O maxAge é derivado de JWT_EXPIRES_IN com o mesmo parser (ms) que o
// jsonwebtoken usa internamente, e entra apenas no momento da escrita.
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
  const maxAge = ms(jwtExpiresIn);

  // Fail-fast: um JWT_EXPIRES_IN inválido não pode virar cookie de sessão
  // silenciosamente — mesma filosofia do EnvSchema (erro no boot).
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
