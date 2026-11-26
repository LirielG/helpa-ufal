import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { EnvSchema } from "@/config/env.js";
import { FULL_NAME_MAX_LENGTH } from "@/schemas/common/FieldLimits.js";

const minimalEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/helpa",
  JWT_SECRET: "x".repeat(32),
};

describe("EnvSchema — rate limiting", () => {
  it("uses the default rate limiting policy and trusts no proxies", () => {
    const parsed = EnvSchema.parse(minimalEnv);

    expect(parsed.RATE_LIMIT_ENABLED).toBe(true);
    expect(parsed.TRUST_PROXY).toBe(0);
    expect(parsed.RATE_LIMIT_ANONYMOUS_PER_MINUTE).toBe(120);
    expect(parsed.RATE_LIMIT_AUTHENTICATED_PER_MINUTE).toBe(300);
    expect(parsed.RATE_LIMIT_GLOBAL_PER_MINUTE).toBe(3000);
  });

  it.each(["true", "false"])("parses RATE_LIMIT_ENABLED=%s", (value) => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      RATE_LIMIT_ENABLED: value,
    });

    expect(parsed.RATE_LIMIT_ENABLED).toBe(value === "true");
  });

  it("rejects an invalid RATE_LIMIT_ENABLED value", () => {
    const result = EnvSchema.safeParse({
      ...minimalEnv,
      RATE_LIMIT_ENABLED: "sometimes",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["RATE_LIMIT_ENABLED"]);
  });

  it.each(["0", "1", "2"])("parses TRUST_PROXY=%s as a number", (value) => {
    const parsed = EnvSchema.parse({ ...minimalEnv, TRUST_PROXY: value });

    expect(parsed.TRUST_PROXY).toBe(Number(value));
  });

  it.each(["-1", "1.5", "abc"])("rejects TRUST_PROXY=%s", (value) => {
    const result = EnvSchema.safeParse({ ...minimalEnv, TRUST_PROXY: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["TRUST_PROXY"]);
  });

  describe.each([
    "RATE_LIMIT_ANONYMOUS_PER_MINUTE",
    "RATE_LIMIT_AUTHENTICATED_PER_MINUTE",
    "RATE_LIMIT_GLOBAL_PER_MINUTE",
  ] as const)("%s", (name) => {
    it("accepts a positive integer override", () => {
      const parsed = EnvSchema.parse({ ...minimalEnv, [name]: "25" });

      expect(parsed[name]).toBe(25);
    });

    it.each(["0", "-1", "1.5", "abc", ""])("rejects %s", (value) => {
      const result = EnvSchema.safeParse({ ...minimalEnv, [name]: value });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([name]);
    });
  });
});

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

describe("EnvSchema — APP_PUBLIC_URL", () => {
  it("defaults to http://localhost:5173 when unset", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.APP_PUBLIC_URL).toBe("http://localhost:5173");
  });

  it("accepts a custom http(s) URL, keeping its path", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      APP_PUBLIC_URL: "https://helpa.ufal.br/app",
    });

    expect(parsed.APP_PUBLIC_URL).toBe("https://helpa.ufal.br/app");
  });

  it.each([
    ["https://helpa.ufal.br/", "https://helpa.ufal.br"],
    ["https://helpa.ufal.br/app/", "https://helpa.ufal.br/app"],
  ])("removes the trailing slash from %s", (value, expected) => {
    const parsed = EnvSchema.parse({ ...minimalEnv, APP_PUBLIC_URL: value });

    expect(parsed.APP_PUBLIC_URL).toBe(expected);
  });

  it("lowercases scheme and host, so the printed address never shows HTTPS://", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      APP_PUBLIC_URL: "HTTPS://Helpa.UFAL.br/app",
    });

    expect(parsed.APP_PUBLIC_URL).toBe("https://helpa.ufal.br/app");
  });

  // `/validate/<code>` is appended to the value, which would land inside a
  // query string or fragment.
  it.each([
    "helpa.ufal.br",
    "ftp://helpa.ufal.br",
    "https://helpa.ufal.br/?utm=x",
    "https://helpa.ufal.br/#/",
  ])("rejects %s, naming the variable in the error", (value) => {
    const result = EnvSchema.safeParse({
      ...minimalEnv,
      APP_PUBLIC_URL: value,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["APP_PUBLIC_URL"]);
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

  // The issue message alone is generic ("Invalid URL"); it is the issue path
  // that names the offending variable, so that is what we pin down.
  it("rejects a non-URL value, naming the variable in the error", () => {
    const result = EnvSchema.safeParse({
      ...minimalEnv,
      SIGAA_BASE_URL: "sigaa.sig.ufal.br",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["SIGAA_BASE_URL"]);
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

  it.each(["abc", "0", "-1", "1.5"])(
    "rejects %s, naming the variable in the error",
    (value) => {
      const result = EnvSchema.safeParse({
        ...minimalEnv,
        SIGAA_CACHE_TTL_HOURS: value,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["SIGAA_CACHE_TTL_HOURS"]);
    },
  );
});

describe("EnvSchema — ADMIN_FULL_NAME", () => {
  it("accepts a name at the length limit", () => {
    const name = "a".repeat(FULL_NAME_MAX_LENGTH);

    const parsed = EnvSchema.parse({ ...minimalEnv, ADMIN_FULL_NAME: name });

    expect(parsed.ADMIN_FULL_NAME).toBe(name);
  });

  it("rejects a name one character over the limit, naming the variable", () => {
    const result = EnvSchema.safeParse({
      ...minimalEnv,
      ADMIN_FULL_NAME: "a".repeat(FULL_NAME_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["ADMIN_FULL_NAME"]);
  });
});

describe("EnvSchema — ADMIN teacher fields", () => {
  it("leaves ADMIN_REGISTRATION_CODE, ADMIN_CNDB, and ADMIN_COURSE undefined when unset", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.ADMIN_REGISTRATION_CODE).toBeUndefined();
    expect(parsed.ADMIN_CNDB).toBeUndefined();
    expect(parsed.ADMIN_COURSE).toBeUndefined();
  });

  it("accepts non-empty strings for ADMIN_REGISTRATION_CODE, ADMIN_CNDB, and ADMIN_COURSE", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      ADMIN_REGISTRATION_CODE: "SIAPE123456",
      ADMIN_CNDB: "CNDB123456",
      ADMIN_COURSE: "Ciência da Computação",
    });

    expect(parsed.ADMIN_REGISTRATION_CODE).toBe("SIAPE123456");
    expect(parsed.ADMIN_CNDB).toBe("CNDB123456");
    expect(parsed.ADMIN_COURSE).toBe("Ciência da Computação");
  });

  it.each(["ADMIN_REGISTRATION_CODE", "ADMIN_CNDB", "ADMIN_COURSE"] as const)(
    "rejects an empty string for %s, naming the variable in the error",
    (variable) => {
      const result = EnvSchema.safeParse({
        ...minimalEnv,
        [variable]: "",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([variable]);
    },
  );
});

describe("EnvSchema — SMTP and MAIL_FROM", () => {
  const productionSmtpEnv = {
    ...minimalEnv,
    NODE_ENV: "production",
    SMTP_HOST: "smtp-relay.brevo.com",
    SMTP_USER: "login@smtp-brevo.com",
    SMTP_PASS: "smtp-password",
    MAIL_FROM: "Helpa <no-reply@helpa.ufal.br>",
  };

  it("defaults SMTP_PORT to 587 and leaves SMTP_SECURE undefined", () => {
    const parsed = EnvSchema.parse({ ...minimalEnv });

    expect(parsed.SMTP_PORT).toBe(587);
    expect(parsed.SMTP_SECURE).toBeUndefined();
  });

  it("parses SMTP_PORT and SMTP_SECURE overrides", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
    });

    expect(parsed.SMTP_PORT).toBe(465);
    expect(parsed.SMTP_SECURE).toBe(true);
  });

  it.each(["development", "test"])(
    "leaves the SMTP variables and MAIL_FROM optional with NODE_ENV=%s",
    (nodeEnv) => {
      const parsed = EnvSchema.parse({ ...minimalEnv, NODE_ENV: nodeEnv });

      expect(parsed.SMTP_HOST).toBeUndefined();
      expect(parsed.SMTP_USER).toBeUndefined();
      expect(parsed.SMTP_PASS).toBeUndefined();
      expect(parsed.MAIL_FROM).toBeUndefined();
    },
  );

  it("accepts a complete SMTP configuration in production", () => {
    const parsed = EnvSchema.parse(productionSmtpEnv);

    expect(parsed.SMTP_HOST).toBe("smtp-relay.brevo.com");
    expect(parsed.MAIL_FROM).toBe("Helpa <no-reply@helpa.ufal.br>");
  });

  it.each(["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const)(
    "rejects a production environment without %s, naming the variable",
    (variable) => {
      const { [variable]: _omitted, ...rest } = productionSmtpEnv;

      const result = EnvSchema.safeParse(rest);

      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0]?.path).toEqual([variable]);
      expect(result.error?.issues[0]?.message).toContain(variable);
    },
  );

  it.each(["smtp.ethereal.email", "SMTP.Ethereal.Email"])(
    "rejects SMTP_HOST=%s in production",
    (host) => {
      const result = EnvSchema.safeParse({
        ...productionSmtpEnv,
        SMTP_HOST: host,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["SMTP_HOST"]);
      expect(result.error?.issues[0]?.message).toContain("SMTP_HOST");
    },
  );

  it("accepts an Ethereal SMTP_HOST outside production", () => {
    const parsed = EnvSchema.parse({
      ...minimalEnv,
      NODE_ENV: "development",
      SMTP_HOST: "smtp.ethereal.email",
    });

    expect(parsed.SMTP_HOST).toBe("smtp.ethereal.email");
  });
});
