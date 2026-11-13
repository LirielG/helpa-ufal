import { describe, expect, it } from "vitest";
import {
  getWorkloadLabel,
  formatWorkloadHours,
  formatHomologatedWorkloadHours,
} from "../workload";

describe("getWorkloadLabel", () => {
  it("returns 'hora' for 1 hour", () => {
    expect(getWorkloadLabel(1)).toBe("hora");
  });

  it("returns 'horas' for 0 hours", () => {
    expect(getWorkloadLabel(0)).toBe("horas");
  });

  it("returns 'horas' for values greater than 1", () => {
    expect(getWorkloadLabel(2)).toBe("horas");
    expect(getWorkloadLabel(10)).toBe("horas");
  });
});

describe("formatWorkloadHours", () => {
  it("formats 1 hour using the singular", () => {
    expect(formatWorkloadHours(1)).toBe("1 hora");
  });

  it("formats 0 and multiple hours using the plural", () => {
    expect(formatWorkloadHours(0)).toBe("0 horas");
    expect(formatWorkloadHours(5)).toBe("5 horas");
  });
});

describe("formatHomologatedWorkloadHours", () => {
  it("formats 1 hour using the singular for both words", () => {
    expect(formatHomologatedWorkloadHours(1)).toBe("1 hora homologada");
  });

  it("formats multiple hours using the plural", () => {
    expect(formatHomologatedWorkloadHours(2)).toBe("2 horas homologadas");
    expect(formatHomologatedWorkloadHours(18)).toBe("18 horas homologadas");
  });
});
