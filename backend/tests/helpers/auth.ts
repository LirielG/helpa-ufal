import { signJwt } from "@/utils/jwt.js";
import type { AuthenticatedUser } from "@/types/auth.js";

/**
 * The `id` must match an existing User when the route looks it up
 * (e.g. PATCH /activities/:activityId/status). Prefer the factories, which return
 * `{ user, token }` paired.
 *
 * Without `tokenVersion` the token carries no claim, which the middleware reads
 * as version 0 — the stored default, so fixtures need not set it.
 */
export function signToken(
  user: Omit<AuthenticatedUser, "tokenVersion"> & { tokenVersion?: number },
  expiresIn = "1h",
): string {
  return signJwt(user as AuthenticatedUser, expiresIn);
}

export function studentToken(id: string, isManager = false): string {
  return signToken({ id, userType: "STUDENT", isManager });
}

export function teacherToken(id: string, isManager = false): string {
  return signToken({ id, userType: "TEACHER", isManager });
}

export function managerToken(
  id: string,
  userType: AuthenticatedUser["userType"] = "TEACHER",
): string {
  return signToken({ id, userType, isManager: true });
}

/** Token with an invalid signature (for covering the 401 path.) */
export function invalidToken(): string {
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UifQ.assinatura-invalida";
}

/** Ready for `.set(...authHeader(token))`. */
export function authHeader(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}

/** Ready for `.set(...authCookie(token))`. */
export function authCookie(token: string): [string, string] {
  return ["Cookie", `token=${token}`];
}
