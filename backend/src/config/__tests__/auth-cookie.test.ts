import { describe, expect, it } from "vitest";
import { env } from "@/config/env.js";
import {
  authCookieMaxAge,
  authCookieOptions,
  buildAuthCookieOptions,
  deriveCookieMaxAge,
} from "@/config/auth-cookie.js";

describe("buildAuthCookieOptions", () => {
  it("always sets httpOnly", () => {
    const options = buildAuthCookieOptions({
      nodeEnv: "development",
      sameSite: "strict",
    });

    expect(options.httpOnly).toBe(true);
  });

  it("is secure only in production", () => {
    expect(
      buildAuthCookieOptions({ nodeEnv: "production", sameSite: "strict" })
        .secure,
    ).toBe(true);
    expect(
      buildAuthCookieOptions({ nodeEnv: "development", sameSite: "strict" })
        .secure,
    ).toBe(false);
    expect(
      buildAuthCookieOptions({ nodeEnv: "test", sameSite: "strict" }).secure,
    ).toBe(false);
  });

  it.each(["strict", "lax", "none"] as const)(
    "passes sameSite=%s through",
    (sameSite) => {
      const options = buildAuthCookieOptions({ nodeEnv: "test", sameSite });

      expect(options.sameSite).toBe(sameSite);
    },
  );

  it("never carries maxAge/expires — clearCookie must not receive them", () => {
    const options = buildAuthCookieOptions({
      nodeEnv: "production",
      sameSite: "none",
    });

    expect(options).not.toHaveProperty("maxAge");
    expect(options).not.toHaveProperty("expires");
  });
});

describe("deriveCookieMaxAge", () => {
  it("derives 86400000 ms from the default '1d'", () => {
    expect(deriveCookieMaxAge("1d")).toBe(86_400_000);
  });

  it("derives hours with the same ms semantics", () => {
    expect(deriveCookieMaxAge("2h")).toBe(7_200_000);
  });

  it("treats bare numeric strings as milliseconds, like jsonwebtoken does", () => {
    // Paridade de parser: "120" vale 120ms tanto no sign quanto no cookie.
    expect(deriveCookieMaxAge("120")).toBe(120);
  });

  it("fails fast on an unparseable value instead of emitting a session cookie", () => {
    expect(() => deriveCookieMaxAge("banana")).toThrow(/JWT_EXPIRES_IN/);
  });
});

describe("env-bound constants", () => {
  it("exposes base options derived from env", () => {
    expect(authCookieOptions).toEqual(
      buildAuthCookieOptions({
        nodeEnv: env.NODE_ENV,
        sameSite: env.COOKIE_SAME_SITE,
      }),
    );
  });

  it("exposes maxAge derived from JWT_EXPIRES_IN", () => {
    expect(authCookieMaxAge).toBe(deriveCookieMaxAge(env.JWT_EXPIRES_IN));
  });
});
