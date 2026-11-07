import { describe, expect, it } from "vitest";
import {
  activityDescriptionSchema,
  activityTitleSchema,
  activityTitleSchemaFor,
} from "../activity";

function errorOf(value: string) {
  return activityDescriptionSchema.safeParse(value).error?.issues[0]?.message;
}

describe("activityTitleSchema", () => {
  it.each([
    ["", "O título é obrigatório"],
    ["   ", "O título é obrigatório"],
    ["A", "O título deve ter no mínimo 3 caracteres"],
    ["Ab", "O título deve ter no mínimo 3 caracteres"],
    ["  Ab  ", "O título deve ter no mínimo 3 caracteres"],
    ["a".repeat(151), "O título deve ter no máximo 150 caracteres."],
  ])("rejects %j with the shared message", (title, message) => {
    expect(activityTitleSchema.safeParse(title).error?.issues[0]?.message).toBe(
      message,
    );
  });

  it.each(["Abc", "a".repeat(150)])(
    "accepts and trims a title at a length boundary",
    (title) => {
      expect(activityTitleSchema.parse(`  ${title}  `)).toBe(title);
    },
  );
});

describe("activityTitleSchemaFor", () => {
  it.each(["A", "Ab", "  Ab  "])(
    "accepts the saved short title %j after trimming both values",
    (savedTitle) => {
      expect(
        activityTitleSchemaFor(savedTitle).parse(`  ${savedTitle.trim()}  `),
      ).toBe(savedTitle.trim());
    },
  );

  it.each(["B", "Bc", "  Bc  "])("rejects another short title %j", (title) => {
    expect(
      activityTitleSchemaFor("Ab").safeParse(title).error?.issues[0]?.message,
    ).toBe("O título deve ter no mínimo 3 caracteres");
  });

  it.each([
    ["", "O título é obrigatório"],
    ["   ", "O título é obrigatório"],
    ["a".repeat(151), "O título deve ter no máximo 150 caracteres."],
  ])("still validates a saved invalid title %j", (savedTitle, message) => {
    expect(
      activityTitleSchemaFor(savedTitle).safeParse(savedTitle).error?.issues[0]
        ?.message,
    ).toBe(message);
  });
});

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
