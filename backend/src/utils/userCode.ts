import { createHmac } from "node:crypto";
import { env } from "@/config/env.js";

// 8 Crockford characters give 40 bits, shown as XXXX-XXXX in the e-mail.
export const USER_CODE_LENGTH = 8;

// Keyed with a secret that lives outside the database: with only 40 bits, a
// plain hash leaked in a dump could be brute-forced offline while the code is
// still valid. Rotating JWT_SECRET invalidates pending codes, which is fine.
export function hashUserCode(code: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(code).digest("hex");
}
