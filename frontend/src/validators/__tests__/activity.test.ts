import { describe, expect, it } from "vitest";
import { activityDescriptionSchema } from "../activity";

function errorOf(value: string) {
  return activityDescriptionSchema.safeParse(value).error?.issues[0]?.message;
}

describe("activityDescriptionSchema", () => {
  it("treats a description made only of spaces as missing", () => {
    expect(errorOf("          ")).toBe("A descrição é obrigatória");
  });

  it("counts the minimum length after trimming", () => {
    expect(errorOf("   abc      ")).toBe(
      "A descrição deve ter no mínimo 10 caracteres",
    );
  });

  it("returns the description without the spaces around it", () => {
    expect(activityDescriptionSchema.parse("  Oficina de leitura  ")).toBe(
      "Oficina de leitura",
    );
  });
});
