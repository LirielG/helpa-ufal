import { describe, it, expect } from "vitest";
import {
  CreateActivitySchema,
  UpdateActivitySchema,
} from "../ActivitySchemas.js";

const ADDRESS = {
  addressLine: "Rua das Flores, 100",
  district: "Centro",
  zipCode: "57300000",
  city: "Arapiraca",
  state: "AL",
};

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Oficina de Introdução à Programação",
    type: "EXTENSION",
    campus: "ARAPIRACA",
    startDate: "2030-01-01T08:00:00.000Z",
    endDate: "2030-01-02T08:00:00.000Z",
    slots: 40,
    description: "Introdução à lógica de programação para iniciantes.",
    area: "Tecnologia",
    workloadHours: 20,
    format: "ONLINE",
    url: "https://meet.example.com/oficina",
    ...overrides,
  };
}

const BODIES = {
  "create ONLINE": (url: string) =>
    [CreateActivitySchema, createBody({ format: "ONLINE", url })] as const,
  "create HYBRID": (url: string) =>
    [
      CreateActivitySchema,
      createBody({ format: "HYBRID", url, address: ADDRESS }),
    ] as const,
  update: (url: string) => [UpdateActivitySchema, { url }] as const,
} as const;

describe.each(Object.entries(BODIES))("url on %s", (_, bodyFor) => {
  it.each(["https://meet.example.com/oficina", "http://exemplo.com"])(
    "accepts %j unchanged",
    (url) => {
      const [schema, body] = bodyFor(url);
      expect(schema.parse(body).url).toBe(url);
    },
  );

  it.each(["javascript:alert(1)", "ftp://x", "https:meet.example.com/oficina"])(
    "rejects %j",
    (url) => {
      const [schema, body] = bodyFor(url);
      const result = schema.safeParse(body);

      expect(result.success).toBe(false);
      expect(result.error!.issues.map(({ path }) => path)).toEqual([["url"]]);
    },
  );
});
