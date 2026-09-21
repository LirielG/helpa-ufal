import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  anAddress,
  createActivity,
  createManager,
  createTeacher,
} from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

describe("PATCH /activities/:id", () => {
  it("rejects a valid token whose user no longer exists in the database (ghost user)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });
    const manager = await createManager();

    await prisma.teacher.deleteMany({ where: { userId: manager.user.id } });
    await prisma.student.deleteMany({ where: { userId: manager.user.id } });
    await prisma.user.delete({ where: { id: manager.user.id } });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(manager.token))
      .send({ title: "Título Atualizado de Usuário Fantasma" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "You do not have permission to update this activity.",
    });
  });

  it("rejects a manager token after the user lost manager status", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });
    const manager = await createManager();

    await prisma.user.update({
      where: { id: manager.user.id },
      data: { isManager: false },
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(manager.token))
      .send({ title: "Tentativa após rebaixamento" });

    expect(response.status).toBe(403);
  });

  it("allows the author to update their own activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ title: "Título Atualizado pelo Autor" });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Título Atualizado pelo Autor");
  });

  // ---------- Validação de Formato e Endereço (Issue #209) ----------

  it("returns 200 when changing HYBRID to IN_PERSON on an activity that already has an address saved", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      format: "HYBRID",
      url: "https://meet.google.com/exemplo",
      address: anAddress(),
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ format: "IN_PERSON" });

    expect(response.status).toBe(200);
    expect(response.body.details.format).toBe("IN_PERSON");
  });

  it("returns 400 from service when changing ONLINE to IN_PERSON without sending or having a saved address", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      format: "ONLINE",
      url: "https://meet.google.com/exemplo",
      address: null,
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ format: "IN_PERSON" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("IN_PERSON activities require an address.");
  });

  it("returns 400 from Zod schema when sending an invalid URL format", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      format: "ONLINE",
      url: "https://meet.google.com/exemplo",
      address: null,
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ url: "não-é-url" });

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