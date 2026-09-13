import { z } from "zod";
import dotenv from "dotenv";

if (process.env["NODE_ENV"]) {
  dotenv.config({ path: `.env.${process.env["NODE_ENV"]}`, quiet: true });
}

dotenv.config({ path: ".env", quiet: true });

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1d"),
  // Origin allowed by CORS (with credentials). Validated as an http(s) URL
  // and normalized to scheme://host[:port] — path and trailing slash are
  // dropped, since the Origin header never carries them.
  CORS_ORIGIN: z
    .string()
    .transform((value, ctx) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          ctx.addIssue({
            code: "custom",
            message: "CORS_ORIGIN must use http or https.",
          });
          return z.NEVER;
        }
        return url.origin;
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "CORS_ORIGIN must be a valid URL.",
        });
        return z.NEVER;
      }
    })
    .default("http://localhost:5173"),
  // SameSite policy for the session cookie. "none" only works with
  // secure=true (NODE_ENV=production) — see .env.example.
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("strict"),
  SIGAA_SYNC_ENABLED: z.stringbool().default(true),
  SIGAA_BASE_URL: z
    .url()
    .default(
      "https://sigaa.sig.ufal.br/sigaa/public/extensao/consulta_extensao.jsf",
    ),
  SIGAA_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(12),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_FULL_NAME: z.string().min(1).optional(),
});

export const env = EnvSchema.parse(process.env);
