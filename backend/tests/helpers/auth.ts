import { signJwt } from "@/utils/jwt.js";
import type { AuthenticatedUser } from "@/types/auth.js";

/**
 * The middleware requires an existing user. Prefer the factories, which
 * return paired `{ user, token }` fixtures.
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

/** Ready for `.set(...authCookie(token))`. */
export function authCookie(token: string): [string, string] {
  return ["Cookie", `token=${token}`];
}
