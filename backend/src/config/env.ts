import { z } from "zod";
import dotenv from "dotenv";

if (process.env["NODE_ENV"]) {
  dotenv.config({ path: `.env.${process.env["NODE_ENV"]}`, quiet: true });
}

dotenv.config({ path: ".env", quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1d"),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_FULL_NAME: z.string().min(1).optional(),
});

export const env = EnvSchema.parse(process.env);
