import { describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

describe("PATCH /activities/:id", () => {
  it("returns 401 without a token", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .send({ title: "Tentativa sem token" });

    expect(response.status).toBe(401);
  });

  // TODO(#148): current behavior (403 with the same message used for
  // "no permission") established as the baseline. ActivityService.update uses
  // the same error path for "ghost user" and "unauthorized third party" —
  // revisit in #148 whether a deleted user should have a distinct status
  // or message (e.g., 401) instead of falling back to the generic 403.
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

  it("allows a manager to update a third party's activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });
    const manager = await createManager();

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(manager.token))
      .send({ title: "Editado pelo Gestor" });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Editado pelo Gestor");
  });

  it("returns 403 when requester is neither the author nor a manager", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });
    const outsider = await createStudent();

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(outsider.token))
      .send({ title: "Tentativa de terceiro" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "You do not have permission to update this activity.",
    });
  });

  it("returns 404 for a non-existent activity", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .patch(`/activities/${randomUUID()}`)
      .set(...authHeader(author.token))
      .send({ title: "Ação inexistente" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      slots: 10,
      deletedAt: new Date(),
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ title: "Tentativa em ação removida" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it.each(["COMPLETED", "CANCELLED"])(
    "returns 409 when the activity status is %s",
    async (status) => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { slots: 10, status });

      const response = await request(app)
        .patch(`/activities/${activity.id}`)
        .set(...authHeader(author.token))
        .send({ title: "Tentativa em ação em estado terminal" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        message: `Activity cannot be updated because it is already ${status}.`,
      });
    },
  );

  it("preserves fields not sent in a partial update", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      title: "Título Original",
      slots: 10,
      campus: "ARAPIRACA",
      type: "COURSE",
    });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ slots: 15 });

    expect(response.status).toBe(200);
    expect(response.body.slots).toBe(15);

    const persisted = await request(app).get(`/activities/${activity.id}`);
    expect(persisted.body.title).toBe("Título Original");
    expect(persisted.body.campus).toBe("ARAPIRACA");
    expect(persisted.body.type).toBe("COURSE");
    expect(persisted.body.slots).toBe(15);
  });
});
