import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { EnvSchema } from "@/config/env.js";

const minimalEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/helpa",
  JWT_SECRET: "x".repeat(32),
};

describe("EnvSchema — CORS_ORIGIN", () => {
  it("defaults to http://localhost:5173 when unset (criteria 1)", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.CORS_ORIGIN).toBe("http://localhost:5173");
  });

  it("accepts a custom origin", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      CORS_ORIGIN: "https://helpa.ufal.br",
    });

    expect(parsed.CORS_ORIGIN).toBe("https://helpa.ufal.br");
  });

  it("normalizes away trailing slash and path — origin is scheme://host[:port]", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      CORS_ORIGIN: "https://helpa.ufal.br/app/",
    });

    expect(parsed.CORS_ORIGIN).toBe("https://helpa.ufal.br");
  });

  it("rejects a non-URL value", () => {
    expect(() =>
      EnvSchema.parse({ ...minimalEnv, CORS_ORIGIN: "localhost:5173" }),
    ).toThrow(ZodError);
  });
});

describe("EnvSchema — COOKIE_SAME_SITE", () => {
  it("defaults to strict (criteria 1)", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.COOKIE_SAME_SITE).toBe("strict");
  });

  it.each(["lax", "none"] as const)("accepts %s", (value) => {
    const parsed = EnvSchema.parse({ ...minimalEnv, COOKIE_SAME_SITE: value });

    expect(parsed.COOKIE_SAME_SITE).toBe(value);
  });

  it("rejects a value outside strict | lax | none", () => {
    expect(() =>
      EnvSchema.parse({ ...minimalEnv, COOKIE_SAME_SITE: "sometimes" }),
    ).toThrow(ZodError);
  });
});

describe("boot fail-fast (criteria 6)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws ZodError at import when COOKIE_SAME_SITE is invalid", async () => {
    vi.stubEnv("COOKIE_SAME_SITE", "sometimes");
    vi.resetModules();

    await expect(import("@/config/env.js")).rejects.toThrow(ZodError);
  });
});
