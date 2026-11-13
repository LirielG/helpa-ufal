import { describe, expect, it } from "vitest";
import {
  displayToISO,
  formatISODate,
  isoToDisplay,
  maskDate,
  maskTime,
} from "../dateField";

describe("dateField", () => {
  describe("isoToDisplay / displayToISO", () => {
    it("converts between aaaa-mm-dd and dd/mm/aaaa", () => {
      expect(isoToDisplay("2026-03-10")).toBe("10/03/2026");
      expect(displayToISO("10/03/2026")).toBe("2026-03-10");
    });

    it("rejects a date that does not exist", () => {
      expect(displayToISO("31/02/2026")).toBeUndefined();
      expect(isoToDisplay("2026-02-31")).toBe("");
    });
  });

  describe("formatISODate", () => {
    it("uses the local day, not the UTC one", () => {
      // 23:30 on the 10th in Brazil is already the 11th in UTC.
      expect(formatISODate(new Date(2026, 2, 10, 23, 30))).toBe("2026-03-10");
    });
  });

  describe("maskDate", () => {
    it.each([
      ["1", "1"],
      ["100", "10/0"],
      ["10032026", "10/03/2026"],
      ["10/03/2026", "10/03/2026"],
      ["1003202699", "10/03/2026"],
    ])("masks %s as %s", (raw, masked) => {
      expect(maskDate(raw)).toBe(masked);
    });
  });

  describe("maskTime", () => {
    it.each([
      ["0830", "08:30"],
      ["12:45", "12:45"],
      ["25:70", "25:70"],
      ["8:", "08:"],
      ["8:3", "08:3"],
      ["8:30", "08:30"],
      ["ab1:2c3 45 6", "12:34"],
    ])("masks %s as %s", (raw, masked) => {
      expect(maskTime(raw)).toBe(masked);
    });
  });
});
