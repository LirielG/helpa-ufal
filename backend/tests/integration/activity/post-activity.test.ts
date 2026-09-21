import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, anAddress } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";
import { daysFromNow } from "../../helpers/dates.js";

function baseActivityPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Workshop de Extensão Universitária",
    type: "EXTENSION",
    campus: "MACEIO",
    startDate: daysFromNow(10).toISOString(),
    endDate: daysFromNow(12).toISOString(),
    slots: 50,
    description: "Atividade prática focada em desenvolvimento e extensão.",
    area: "Tecnologia",
    workloadHours: 20,
    ...overrides,
  };
}

describe("POST /activities (Creation format & URL rules)", () => {
  it("returns 201 when creating an ONLINE activity without a url", async () => {
    const teacher = await createTeacher();

    const payload = baseActivityPayload({
      format: "ONLINE",
    });

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(teacher.token))
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: payload.title,
      type: payload.type,
      status: "OPEN",
    });
  });

  it("returns 400 when creating a HYBRID activity without a url", async () => {
    const teacher = await createTeacher();

    const payload = baseActivityPayload({
      format: "HYBRID",
      address: anAddress(),
    });

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(teacher.token))
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 400,
      message: "Validation error.",
    });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "url" })]),
    );
  });

  it("returns 400 from Zod schema when creating an ONLINE activity with a malformed url", async () => {
    const teacher = await createTeacher();

    const payload = baseActivityPayload({
      format: "ONLINE",
      url: "url-invalida",
    });

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(teacher.token))
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 400,
      message: "Validation error.",
    });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "url" })]),
    );
  });
});