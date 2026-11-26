import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "@/config/env.js";
import type { AuthenticatedUser } from "@/types/auth.js";

const claimsSchema = z.looseObject({
  id: z.string(),
  userType: z.enum(["STUDENT", "TEACHER"]),
  isManager: z.boolean(),
  // Tokens signed before the claim existed belong to version 0.
  tokenVersion: z.number().default(0),
});

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
    return claimsSchema.parse(jwt.verify(token, env.JWT_SECRET));
  } catch {
    return null;
  }
}
