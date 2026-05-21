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
    return jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
  } catch {
    return null;
  }
}
