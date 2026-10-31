import { describe, expect, it } from "vitest";
import {
  formatCertificateDate,
  formatPeriod,
  formatValidationCode,
} from "../format";

describe("formatValidationCode", () => {
  it("splits the stored code in two halves, as printed on the certificate", () => {
    expect(formatValidationCode("7KQ4MX9T2R")).toBe("7KQ4M-X9T2R");
  });
});

// The printed certificate uses Maceió's calendar, so the page must too,
// whatever the viewer's time zone.
describe("formatCertificateDate", () => {
  it("reads the date in Maceió, so 01:30 UTC is still the previous day", () => {
    expect(formatCertificateDate("2026-06-13T01:30:00.000Z")).toBe(
      "12/06/2026",
    );
  });

  it("turns the day at 03:00 UTC, Maceió's midnight", () => {
    expect(formatCertificateDate("2026-06-13T03:00:00.000Z")).toBe(
      "13/06/2026",
    );
  });
});

describe("formatPeriod", () => {
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

  it("shows a single date for an evening action that crosses midnight UTC", () => {
    expect(
      formatPeriod("2026-06-12T22:00:00.000Z", "2026-06-13T01:00:00.000Z"),
    ).toBe("12/06/2026");
  });
});
