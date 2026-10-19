import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import type { AuthenticatedUser } from "@/types/auth.js";

export function signJwt(
  payload: AuthenticatedUser,
  expiresIn?: string,
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: (expiresIn ??
      env.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
  });
}

export function verifyJwt(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;

    // Tokens signed before the claim existed belong to version 0.
    return { ...decoded, tokenVersion: decoded.tokenVersion ?? 0 };
  } catch {
    return null;
  }
}
