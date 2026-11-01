import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env.js";
import type { AuthenticatedUser } from "@/types/auth.js";
import { signJwt, verifyJwt } from "@/utils/jwt.js";

const payload: AuthenticatedUser = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  userType: "STUDENT",
  isManager: false,
  tokenVersion: 2,
};

describe("jwt", () => {
  it("returns the signed payload when verifying a token from signJwt", () => {
    const token = signJwt(payload);

    expect(verifyJwt(token)).toMatchObject(payload);
  });

  it.each([
    ["an expired token", () => signJwt(payload, "-1s")],
    [
      "a token signed with another secret",
      () => jwt.sign(payload, "wrong-secret"),
    ],
    ["a malformed token", () => "not-a-jwt"],
  ])("returns null for %s", (_label, buildToken) => {
    expect(verifyJwt(buildToken())).toBeNull();
  });

  it("defaults tokenVersion to 0 when the token has no tokenVersion claim", () => {
    const { tokenVersion: _omitted, ...claimsWithoutVersion } = payload;
    const token = jwt.sign(claimsWithoutVersion, env.JWT_SECRET);

    expect(verifyJwt(token)).toMatchObject({
      ...claimsWithoutVersion,
      tokenVersion: 0,
    });
  });
});
