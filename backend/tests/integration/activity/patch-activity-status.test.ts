import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createTeacher, createStudent, createManager, createActivity } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

describe("PATCH /activities/:id/status", () => {
  it("returns 401 without a token", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(401);
  });

  it("transitions OPEN -> IN_PROGRESS -> COMPLETED, persisting each step", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const toInProgress = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(toInProgress.status).toBe(200);
    expect(toInProgress.body.status).toBe("IN_PROGRESS");

    const afterFirstStep = await request(app).get(`/activities/${activity.id}`);
    expect(afterFirstStep.body.status).toBe("IN_PROGRESS");

    const toCompleted = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(author.token))
      .send({ status: "COMPLETED" });

    expect(toCompleted.status).toBe(200);
    expect(toCompleted.body.status).toBe("COMPLETED");

    const afterSecondStep = await request(app).get(`/activities/${activity.id}`);
    expect(afterSecondStep.body.status).toBe("COMPLETED");
  });

  it("returns 409 for an invalid transition (OPEN -> COMPLETED)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(author.token))
      .send({ status: "COMPLETED" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "Cannot transition from OPEN to COMPLETED.",
    });
  });

  it("returns 409 when the activity is already CANCELLED", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "CANCELLED" });

    const response = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "Activity is already CANCELLED and cannot be transitioned.",
    });
  });

  it("returns 403 when requester is neither the author nor a manager", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const outsider = await createStudent();

    const response = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(outsider.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "Forbidden. Requester is not the author or a manager.",
    });
  });

  it("returns 404 for a non-existent activity", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .patch(`/activities/${randomUUID()}/status`)
      .set(...authHeader(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 403 for a valid token of a deleted user (ghost user)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const ghost = await createManager();

    await prisma.teacher.deleteMany({ where: { userId: ghost.user.id } });
    await prisma.student.deleteMany({ where: { userId: ghost.user.id } });
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authHeader(ghost.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "Forbidden. Requester is not the author or a manager.",
    });
  });
});
