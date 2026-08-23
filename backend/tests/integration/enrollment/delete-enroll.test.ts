// tests/integration/enrollment/delete-enroll.test.ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createEnrollment,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authHeader, invalidToken } from "../../helpers/auth.js";

// Route contract: docs/Cancel-Enrollment.yml (Bruno).
const enrollUrl = (activityId: string) => `/activities/${activityId}/enroll`;

async function anOpenActivity(slots = 30) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, { slots });
  return { author, activity };
}

describe("DELETE /activities/:id/enroll", () => {
  // ---------- 204 - No Content ----------

  it("soft-deletes the enrollment: row kept as CANCELLED, empty response", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id);

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    // History is preserved: the row stays, marked CANCELLED.
    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: {
        userId_activityId: { userId: student.user.id, activityId: activity.id },
      },
    });
    expect(stored.status).toBe("CANCELLED");
  });

  it("immediately releases the slot in the activity detail", async () => {
    const { author, activity } = await anOpenActivity(1);
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id);

    await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token))
      .expect(204);

    const detail = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authHeader(author.token));

    expect(detail.status).toBe(200);
    expect(detail.body.availableSlots).toBe(1);
  });

  it("also cancels a PENDING enrollment (future creator-approval flow)", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id, { status: "PENDING" });

    await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token))
      .expect(204);

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: {
        userId_activityId: { userId: student.user.id, activityId: activity.id },
      },
    });
    expect(stored.status).toBe("CANCELLED");
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without a token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app).delete(enrollUrl(activity.id));

    expect(response.status).toBe(401);
  });

  it("rejects an invalid or expired token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { activity } = await anOpenActivity();
    const ghost = await createStudent();
    await createEnrollment(ghost.user.id, activity.id);
    const enrollmentId = (
      await prisma.enrollment.findUniqueOrThrow({
        where: {
          userId_activityId: { userId: ghost.user.id, activityId: activity.id },
        },
      })
    ).id;
    await prisma.enrollment.delete({ where: { id: enrollmentId } });
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(ghost.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "User account not found or inactive.",
    });
  });

  // ---------- 404 - Not Found (indistinguishable by contract) ----------

  it("returns 404 for a nonexistent activity", async () => {
    const student = await createStudent();

    const response = await request(app)
      .delete(enrollUrl(randomUUID()))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id);
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 when there is no enrollment for the pair", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Enrollment not found." });
  });

  it("returns 404 when the enrollment was already canceled", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id, { status: "CANCELLED" });

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Enrollment not found." });
  });

  it("returns 404 for another user's enrollment without changing it", async () => {
    // Scoped lookup: canceling someone else's enrollment is indistinguishable
    // from a nonexistent one — no information leaks.
    const { activity } = await anOpenActivity();
    const owner = await createStudent();
    const intruder = await createStudent();
    await createEnrollment(owner.user.id, activity.id);

    const response = await request(app)
      .delete(enrollUrl(activity.id))
      .set(...authHeader(intruder.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Enrollment not found." });

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: {
        userId_activityId: { userId: owner.user.id, activityId: activity.id },
      },
    });
    expect(stored.status).toBe("APPROVED");
  });

  // ---------- 400 - Bad Request ----------

  it("rejects a malformed activity id", async () => {
    const student = await createStudent();

    const response = await request(app)
      .delete(enrollUrl("not-a-uuid"))
      .set(...authHeader(student.token));

    expect(response.status).toBe(400);
  });

  // ---------- Concurrency ----------

  it("a double cancel race yields one 204 and one 404", async () => {
    // The atomic updateMany in the repository makes this deterministic:
    // exactly one request wins the APPROVED -> CANCELLED transition.
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await createEnrollment(student.user.id, activity.id);

    const [first, second] = await Promise.all([
      request(app).delete(enrollUrl(activity.id)).set(...authHeader(student.token)),
      request(app).delete(enrollUrl(activity.id)).set(...authHeader(student.token)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([204, 404]);

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: {
        userId_activityId: { userId: student.user.id, activityId: activity.id },
      },
    });
    expect(stored.status).toBe("CANCELLED");
  });
});