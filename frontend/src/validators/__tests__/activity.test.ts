import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  activityDescriptionSchema,
  activityTitleSchema,
  activityTitleSchemaFor,
  isValidActionUrl,
  maxWorkloadHoursFor,
  normalizeActionUrl,
  validateWorkloadDuration,
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

describe("normalizeActionUrl", () => {
  it.each([
    ["meet.google.com/abc", "https://meet.google.com/abc"],
    ["www.exemplo.com", "https://www.exemplo.com"],
    ["  www.exemplo.com  ", "https://www.exemplo.com"],
    ["http://exemplo.com", "http://exemplo.com"],
    ["HTTPS://exemplo.com", "HTTPS://exemplo.com"],
    ["ftp://x", "ftp://x"],
    ["", ""],
    ["   ", ""],
  ])("turns %j into %j", (value, expected) => {
    expect(normalizeActionUrl(value)).toBe(expected);
  });
});

describe("isValidActionUrl", () => {
  it.each([
    "https://meet.google.com/abc-defg-hij",
    "https://www.exemplo.com",
    "http://exemplo.com",
  ])("accepts %j", (value) => {
    expect(isValidActionUrl(value)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "ftp://x",
    "https://nao-e-um-link",
    "https://exemplo com",
    "https://www.google.com@evil.com",
    normalizeActionUrl("mailto:contato@ufal.br"),
  ])("rejects %j", (value) => {
    expect(isValidActionUrl(value)).toBe(false);
  });
});

describe("validateWorkloadDuration", () => {
  const schema = z
    .object({
      startDate: z.string(),
      startTime: z.string(),
      endDate: z.string(),
      endTime: z.string(),
      workloadHours: z.number(),
    })
    .superRefine(validateWorkloadDuration);

  it("accepts workload equal to the exact duration", () => {
    const result = schema.safeParse({
      startDate: "2026-11-20",
      startTime: "08:00",
      endDate: "2026-11-20",
      endTime: "12:00",
      workloadHours: 4,
    });

    expect(result.success).toBe(true);
  });

  it("rejects workload above the duration and shows the limit in hours", () => {
    const result = schema.safeParse({
      startDate: "2026-11-20",
      startTime: "08:00",
      endDate: "2026-11-20",
      endTime: "12:00",
      workloadHours: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["workloadHours"],
      message: "A carga horária não pode passar da duração da ação (4 h).",
    });
  });

  it("rounds fractional durations down to whole hours", () => {
    expect(
      maxWorkloadHoursFor("2026-11-20", "08:00", "2026-11-20", "12:30"),
    ).toBe(4);

    const result = schema.safeParse({
      startDate: "2026-11-20",
      startTime: "08:00",
      endDate: "2026-11-20",
      endTime: "12:30",
      workloadHours: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "A carga horária não pode passar da duração da ação (4 h).",
    );
  });

  it("formats thousands in pt-BR when duration reaches 1000 hours", () => {
    const result = schema.safeParse({
      startDate: "2026-01-01",
      startTime: "08:00",
      endDate: "2026-02-12",
      endTime: "00:00",
      workloadHours: 1001,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "A carga horária não pode passar da duração da ação (1.000 h).",
    );
  });

  it("skips the workload check when the date range is reversed or invalid", () => {
    expect(
      maxWorkloadHoursFor("2026-11-20", "12:00", "2026-11-20", "08:00"),
    ).toBeNull();
    expect(maxWorkloadHoursFor("", "08:00", "2026-11-20", "12:00")).toBeNull();

    const result = schema.safeParse({
      startDate: "2026-11-20",
      startTime: "12:00",
      endDate: "2026-11-20",
      endTime: "08:00",
      workloadHours: 10,
    });

    expect(result.success).toBe(true);
  });
});
