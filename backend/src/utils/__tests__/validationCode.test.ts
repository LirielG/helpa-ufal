import { describe, expect, it } from "vitest";
import { formatValidationCode } from "@/utils/validationCode.js";

describe("formatValidationCode", () => {
  it("splits the stored code into two groups of five", () => {
    expect(formatValidationCode("7KQ4MX9T2R")).toBe("7KQ4M-X9T2R");
  });
});
