import { describe, expect, it } from "vitest";
import { isValidUUID } from "@/utils/uuid.js";

describe("isValidUUID", () => {
  it("accepts a v4 UUID in lowercase and in uppercase", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it.each([
    ["550e8400-e29b-11d4-a716-446655440000", "another UUID version"],
    ["550e8400-e29b-41d4-0716-446655440000", "an invalid variant"],
    ["", "an empty string"],
    ["not-a-uuid", "arbitrary text"],
  ])("rejects %s (%s)", (input) => {
    expect(isValidUUID(input)).toBe(false);
  });
});
