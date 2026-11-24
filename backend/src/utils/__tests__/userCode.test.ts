import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env.js";
import { hashUserCode } from "@/utils/userCode.js";

describe("hashUserCode", () => {
  it("is the hex HMAC-SHA256 of the code keyed with JWT_SECRET", () => {
    const expected = createHmac("sha256", env.JWT_SECRET)
      .update("ABCDEFGH")
      .digest("hex");

    expect(hashUserCode("ABCDEFGH")).toBe(expected);
  });

  // A plain hash of a 40-bit code could be brute-forced from a database dump.
  it("differs from a plain SHA-256 of the code", () => {
    const plain = createHash("sha256").update("ABCDEFGH").digest("hex");

    expect(hashUserCode("ABCDEFGH")).not.toBe(plain);
  });
});
