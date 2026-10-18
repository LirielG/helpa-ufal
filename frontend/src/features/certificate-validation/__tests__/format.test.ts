import { describe, expect, it } from "vitest";
import {
  formatPeriod,
  formatValidationCode,
  formatWorkloadHours,
} from "../format";

describe("formatValidationCode", () => {
  it("splits the stored code in two halves, as printed on the certificate", () => {
    expect(formatValidationCode("7KQ4MX9T2R")).toBe("7KQ4M-X9T2R");
  });
});

describe("formatPeriod", () => {
  // Midday UTC lands on the same calendar day in every Brazilian time zone.
  it("shows both dates when the action spans several days", () => {
    expect(
      formatPeriod("2026-06-10T13:00:00.000Z", "2026-06-12T15:00:00.000Z"),
    ).toBe("10/06/2026 a 12/06/2026");
  });

  it("shows a single date when the action starts and ends on the same day", () => {
    expect(
      formatPeriod("2026-06-10T12:00:00.000Z", "2026-06-10T16:00:00.000Z"),
    ).toBe("10/06/2026");
  });
});

describe("formatWorkloadHours", () => {
  it("uses the singular for one hour", () => {
    expect(formatWorkloadHours(1)).toBe("1 hora");
  });

  it("uses the plural for more than one hour", () => {
    expect(formatWorkloadHours(8)).toBe("8 horas");
  });
});
