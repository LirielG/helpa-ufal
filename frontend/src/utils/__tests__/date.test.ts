import { describe, expect, it } from "vitest";
import { formatDate, formatTime, fromInputDate, toInputDate } from "../date";

// The suite runs in America/Maceio (UTC-3), pinned in vite.config.ts.
describe("date utils", () => {
  describe("formatDate", () => {
    it("shows the day the viewer is in, not the UTC one", () => {
      // 00:30 UTC on the 11th is still the 10th in Brazil.
      expect(formatDate("2026-03-11T00:30:00.000Z")).toBe("10/03/2026");
    });

    it("falls back when there is no date", () => {
      expect(formatDate(undefined)).toBe("Data não definida");
    });
  });

  describe("formatTime", () => {
    it("converts the stored instant to the viewer's clock", () => {
      expect(formatTime("2026-03-10T11:00:00.000Z")).toBe("08:00");
    });

    it("returns nothing when there is no date", () => {
      expect(formatTime(undefined)).toBe("");
    });
  });

  describe("toInputDate", () => {
    it("shows the day the viewer is in, not the UTC one", () => {
      expect(toInputDate("2026-03-11T00:30:00.000Z")).toBe("2026-03-10");
    });

    it("pads single-digit months and days", () => {
      expect(toInputDate("2026-01-05T12:00:00.000Z")).toBe("2026-01-05");
    });

    it.each([undefined, "", "not-a-date"])(
      "returns nothing for %o",
      (value) => {
        expect(toInputDate(value)).toBe("");
      },
    );
  });

  describe("fromInputDate", () => {
    it("sends local midnight as the matching UTC instant", () => {
      expect(fromInputDate("2026-03-10")).toBe("2026-03-10T03:00:00.000Z");
    });

    it("returns nothing for an empty field", () => {
      expect(fromInputDate("")).toBe("");
    });
  });

  // The edit screen reads a date out of the API and writes it back untouched,
  // so the pair has to survive the round trip without drifting a day.
  it("round-trips a date the user did not touch", () => {
    expect(toInputDate(fromInputDate("2026-03-10"))).toBe("2026-03-10");
  });
});
