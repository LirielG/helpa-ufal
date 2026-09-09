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
  // Origem permitida pelo CORS (com credentials). Validada como URL http(s)
  // e normalizada para scheme://host[:porta] — path e barra final são
  // descartados, pois o header Origin nunca os carrega.
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
  // Política SameSite do cookie de sessão. "none" só funciona com
  // secure=true (NODE_ENV=production) — ver .env.example.
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("strict"),
  SIGAA_SYNC_ENABLED: z.stringbool().default(true),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_FULL_NAME: z.string().min(1).optional(),
});

export const env = EnvSchema.parse(process.env);
