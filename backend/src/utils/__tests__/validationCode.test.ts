import { describe, expect, it } from "vitest";
import {
  formatValidationCode,
  generateValidationCode,
  normalizeValidationCode,
} from "@/utils/validationCode.js";

const STORED_CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

describe("generateValidationCode", () => {
  it("only ever draws 10 Crockford characters, never I, L, O or U", () => {
    for (let i = 0; i < 10_000; i++) {
      expect(generateValidationCode()).toMatch(STORED_CODE);
    }
  });

  it("draws a different code each time", () => {
    expect(generateValidationCode()).not.toBe(generateValidationCode());
  });
});

describe("normalizeValidationCode", () => {
  it("drops spaces and hyphens and uppercases what the user typed", () => {
    expect(normalizeValidationCode(" 7kq4m-x9t2r ")).toBe("7KQ4MX9T2R");
  });

  // Copying from a PDF or a word processor often brings typographic dashes
  // and no-break spaces instead of the plain "-" and " " printed.
  it.each([
    ["7KQ4M‐X9T2R", "hyphen"],
    ["7KQ4M‑X9T2R", "non-breaking hyphen"],
    ["7KQ4M–X9T2R", "dash (en)"],
    ["7KQ4M—X9T2R", "dash (em)"],
    ["7KQ4M−X9T2R", "minus sign"],
    ["7KQ4M X9T2R", "no-break space"],
  ])("accepts %s, with a %s as separator", (input) => {
    expect(normalizeValidationCode(input)).toBe("7KQ4MX9T2R");
  });

  it("reads O as 0 and I or L as 1, the way Crockford intends", () => {
    expect(normalizeValidationCode("7KQ4MX9T2O")).toBe("7KQ4MX9T20");
    expect(normalizeValidationCode("7KQ4MX9TIl")).toBe("7KQ4MX9T11");
  });

  it.each(["7KQ4MX9T2", "7KQ4MX9T2RA"])(
    "rejects %s — the code has exactly 10 characters",
    (input) => {
      expect(normalizeValidationCode(input)).toBeNull();
    },
  );

  it("rejects U, which has no meaning in the alphabet", () => {
    expect(normalizeValidationCode("7KQ4MX9T2U")).toBeNull();
  });
});

describe("formatValidationCode", () => {
  it("splits the stored code into two groups of five", () => {
    expect(formatValidationCode("7KQ4MX9T2R")).toBe("7KQ4M-X9T2R");
  });
});
