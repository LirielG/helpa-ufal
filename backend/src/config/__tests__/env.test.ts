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

describe("EnvSchema — SIGAA_BASE_URL", () => {
  it("defaults to the SIGAA public extension search page when unset", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.SIGAA_BASE_URL).toBe(
      "https://sigaa.sig.ufal.br/sigaa/public/extensao/consulta_extensao.jsf",
    );
  });

  it("accepts a custom URL", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      SIGAA_BASE_URL: "https://sigaa.example.br/consulta.jsf",
    });

    expect(parsed.SIGAA_BASE_URL).toBe("https://sigaa.example.br/consulta.jsf");
  });

  it("rejects a non-URL value", () => {
    expect(() =>
      EnvSchema.parse({ ...minimalEnv, SIGAA_BASE_URL: "sigaa.sig.ufal.br" }),
    ).toThrow(ZodError);
  });
});

describe("EnvSchema — SIGAA_CACHE_TTL_HOURS", () => {
  it("defaults to 12 hours when unset", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.SIGAA_CACHE_TTL_HOURS).toBe(12);
  });

  it("coerces the raw string into a number", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      SIGAA_CACHE_TTL_HOURS: "6",
    });

    expect(parsed.SIGAA_CACHE_TTL_HOURS).toBe(6);
  });

  it.each(["abc", "0", "-1", "1.5"])("rejects %s", (value) => {
    expect(() =>
      EnvSchema.parse({ ...minimalEnv, SIGAA_CACHE_TTL_HOURS: value }),
    ).toThrow(ZodError);
  });
});
