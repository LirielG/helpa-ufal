import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createTeacher,
  createStudent,
  createManager,
  createActivity,
  createEnrollment,
  anAddress,
} from "../../helpers/factories.js";
import { authCookie } from "../../helpers/auth.js";

describe("PUT /activities/:activityId/status", () => {
  it("returns the same complete activity as an authenticated GET after PUT", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      address: anAddress(),
    });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(200);
    const retrieved = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authCookie(author.token));

    expect(retrieved.status).toBe(200);
    expect(response.body).toEqual(retrieved.body);
    expect(response.body).toMatchObject({
      status: "IN_PROGRESS",
      enrollmentStatus: null,
      details: {
        description: activity.details.description,
        address: anAddress(),
      },
    });
  });

  it("rejects the old PATCH route without changing the activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .patch(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" })
      .expect(404);

    const retrieved = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authCookie(author.token));
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.status).toBe("OPEN");
  });

  it.each(["APPROVED", "PENDING", "CANCELLED"] as const)(
    "returns the manager's %s enrollment when transitioning another author's activity",
    async (enrollmentStatus) => {
      const author = await createTeacher();
      const manager = await createManager();
      const activity = await createActivity(author.user.id);
      await createEnrollment(author.user.id, activity.id, {
        status: "PENDING",
      });
      await createEnrollment(manager.user.id, activity.id, {
        status: enrollmentStatus,
      });

      const response = await request(app)
        .put(`/activities/${activity.id}/status`)
        .set(...authCookie(manager.token))
        .send({ status: "CANCELLED" });
      const retrieved = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(manager.token));

      expect(response.status).toBe(200);
      expect(retrieved.status).toBe(200);
      expect(response.body).toEqual(retrieved.body);
      expect(response.body.enrollmentStatus).toBe(enrollmentStatus);
      expect(response.body.status).toBe("CANCELLED");
    },
  );

  it.each([
    { slots: 40, approved: 13, available: 27 },
    { slots: 1, approved: 2, available: 0 },
  ])(
    "returns $available available slots for $approved approved enrollments and $slots slots",
    async ({ slots, approved, available }) => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { slots });
      for (let i = 0; i < approved; i += 1) {
        const participant = await createStudent();
        await createEnrollment(participant.user.id, activity.id);
      }
      const pending = await createStudent();
      await createEnrollment(pending.user.id, activity.id, {
        status: "PENDING",
      });
      const cancelled = await createStudent();
      await createEnrollment(cancelled.user.id, activity.id, {
        status: "CANCELLED",
      });

      const response = await request(app)
        .put(`/activities/${activity.id}/status`)
        .set(...authCookie(author.token))
        .send({ status: "IN_PROGRESS" });
      const retrieved = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(author.token));

      expect(response.status).toBe(200);
      expect(retrieved.status).toBe(200);
      expect(response.body).toEqual(retrieved.body);
      expect(response.body.availableSlots).toBe(available);
    },
  );

  it.each([true, false])(
    "preserves nullable data in the canonical response (missing details: %s)",
    async (missingDetails) => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, {
        format: "ONLINE",
      });
      if (missingDetails) {
        await prisma.activityDetails.delete({
          where: { activityId: activity.id },
        });
      }

      const response = await request(app)
        .put(`/activities/${activity.id}/status`)
        .set(...authCookie(author.token))
        .send({ status: "CANCELLED" });
      const retrieved = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(author.token));

      expect(response.status).toBe(200);
      expect(retrieved.status).toBe(200);
      expect(response.body).toEqual(retrieved.body);
      expect(response.body.details).toEqual(
        missingDetails
          ? null
          : {
              description: activity.details.description,
              area: activity.details.area,
              format: "ONLINE",
              url: null,
              workloadHours: activity.details.workloadHours,
              address: null,
            },
      );
    },
  );

  it("returns 400 when status is not a valid enum value", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "NOT_A_STATUS" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      {
        field: "status",
        code: "VALIDATION_ERROR",
        message:
          'Invalid option: expected one of "IN_PROGRESS"|"COMPLETED"|"CANCELLED"',
      },
    ]);
  });

  it("returns 401 without a token", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(401);
  });

  it("transitions OPEN -> IN_PROGRESS -> COMPLETED, persisting each step", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const toInProgress = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(toInProgress.status).toBe(200);
    expect(toInProgress.body.status).toBe("IN_PROGRESS");

    const afterFirstStep = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authCookie(author.token));
    expect(afterFirstStep.status).toBe(200);
    expect(toInProgress.body).toEqual(afterFirstStep.body);

    const toCompleted = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "COMPLETED" });

    expect(toCompleted.status).toBe(200);
    expect(toCompleted.body.status).toBe("COMPLETED");

    const afterSecondStep = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authCookie(author.token));
    expect(afterSecondStep.status).toBe(200);
    expect(toCompleted.body).toEqual(afterSecondStep.body);
  });

  it("returns 409 for an invalid transition (OPEN -> COMPLETED)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "COMPLETED" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "Cannot transition from OPEN to COMPLETED.",
    });
  });

  it("returns 409 when the activity is already CANCELLED", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "CANCELLED",
    });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "Activity is already CANCELLED and cannot be transitioned.",
    });
  });

  it("returns 403 when requester is neither the author nor a manager", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const outsider = await createStudent();

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(outsider.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "Forbidden. Requester is not the author or a manager.",
    });
  });

  it("returns 404 for a non-existent activity", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .put(`/activities/${randomUUID()}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Activity not found.",
    });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      deletedAt: new Date(),
    });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Activity not found.",
    });
  });

  it("returns 401 for a valid token of a deleted user (ghost user)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const ghost = await createManager();

    await prisma.teacher.deleteMany({ where: { userId: ghost.user.id } });
    await prisma.student.deleteMany({ where: { userId: ghost.user.id } });
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(ghost.token))
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "SESSION_INVALID",
      message: "Session is no longer valid.",
    });
  });
});
