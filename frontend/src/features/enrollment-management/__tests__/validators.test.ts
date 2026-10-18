import { describe, it, expect } from "vitest";
import { validateWorkloadHours } from "../validators";

describe("validateWorkloadHours", () => {
  const CEILING = 8;

  it.each(["1", "8", "5"])("accepts %s hours", (value) => {
    expect(validateWorkloadHours(value, CEILING)).toBeNull();
  });

  it("asks for the hours when the field is empty", () => {
    expect(validateWorkloadHours("", CEILING)).toBe(
      "Informe as horas cumpridas.",
    );
  });

  it.each(["2.5", "abc"])("rejects %s as not a whole number", (value) => {
    expect(validateWorkloadHours(value, CEILING)).toBe(
      "Informe um número inteiro de horas.",
    );
  });

  it.each(["0", "-3"])("rejects %s as below the minimum", (value) => {
    expect(validateWorkloadHours(value, CEILING)).toBe(
      "As horas devem ser no mínimo 1.",
    );
  });

  it("rejects hours above the activity's workload", () => {
    expect(validateWorkloadHours("9", CEILING)).toBe(
      "As horas não podem passar da carga horária da ação (8 h).",
    );
  });
});
