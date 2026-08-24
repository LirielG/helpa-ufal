// tests/integration/enrollment/post-enroll.test.ts
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

// Route contract: docs/Create-Enrollment.yml (Bruno).
// If the team flattens the route (POST /enroll), this helper is the only line to change.
const enrollUrl = (activityId: string) => `/activities/${activityId}/enroll`;

async function anOpenActivity(slots = 30) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, { slots });
  return { author, activity };
}

describe("POST /activities/:id/enroll", () => {
  // ---------- 201 - Created ----------

  it("creates an APPROVED enrollment for the authenticated user", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      activityId: activity.id,
      userId: student.user.id,
      createdAt: expect.any(String), // dates cross HTTP as ISO strings
    });

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: {
        userId_activityId: { userId: student.user.id, activityId: activity.id },
      },
    });
    expect(stored.status).toBe("APPROVED");
  });

  it("reactivates a previously CANCELLED enrollment, reusing the same record", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    const canceled = await createEnrollment(student.user.id, activity.id, {
      status: "CANCELLED",
      enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
      attendanceConfirmed: true,
    });

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(canceled.id);
    // Contract decision: createdAt is the record's ORIGINAL creation date.
    expect(response.body.createdAt).toBe(canceled.createdAt.toISOString());

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: { id: canceled.id },
    });
    expect(stored.status).toBe("APPROVED");
    expect(stored.attendanceConfirmed).toBe(false);
    expect(stored.enrolledAt.getTime()).toBeGreaterThan(
      new Date("2026-01-01T00:00:00.000Z").getTime(),
    );

    const rows = await prisma.enrollment.count({
      where: { userId: student.user.id, activityId: activity.id },
    });
    expect(rows).toBe(1);
  });

  it("immediately consumes a slot in the activity detail", async () => {
    const { author, activity } = await anOpenActivity(2);
    const student = await createStudent();

    await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token))
      .expect(201);

    const detail = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authHeader(author.token));

    expect(detail.status).toBe(200);
    expect(detail.body.availableSlots).toBe(1);
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without a token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app).post(enrollUrl(activity.id));

    expect(response.status).toBe(401);
    // Message is owned by AuthMiddleware ("No token provided.") and predates
    // the contract's "Unauthenticated." — assert only the status until the
    // team aligns middleware vs contract.
  });

  it("rejects an invalid or expired token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    // Ghost user: the JWT is valid, but the account is gone. The service
    // checks the database (light hybrid authentication, per contract).
    const { activity } = await anOpenActivity();
    const ghost = await createStudent();
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(ghost.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "User account not found or inactive.",
    });
  });

  // ---------- 404 - Not Found ----------

  it("returns 404 for a nonexistent activity", async () => {
    const student = await createStudent();

    const response = await request(app)
      .post(enrollUrl(randomUUID()))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    // deletedAt (soft delete) is 404; status CANCELLED (lifecycle) is 409 —
    // the two tests side by side pin the distinction.
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  // ---------- 409 - Conflict ----------

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "returns 409 when the activity status is %s",
    async (status) => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status });
      const student = await createStudent();

      const response = await request(app)
        .post(enrollUrl(activity.id))
        .set(...authHeader(student.token));

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        message: "Activity is not open for enrollment.",
      });
    },
  );

  it("returns 409 when the user is already enrolled, keeping a single row", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token))
      .expect(201);

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(student.token));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "User is already enrolled in this activity.",
    });

    const rows = await prisma.enrollment.count({
      where: { userId: student.user.id, activityId: activity.id },
    });
    expect(rows).toBe(1);
  });

  it("returns 409 when the activity has no available slots", async () => {
    const { activity } = await anOpenActivity(1);
    const first = await createStudent();
    const second = await createStudent();
    await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(first.token))
      .expect(201);

    const response = await request(app)
      .post(enrollUrl(activity.id))
      .set(...authHeader(second.token));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "No available slots for this activity.",
    });
  });

  // ---------- 400 - Bad Request ----------

  it("rejects a malformed activity id", async () => {
    const student = await createStudent();

    const response = await request(app)
      .post(enrollUrl("not-a-uuid"))
      .set(...authHeader(student.token));

    expect(response.status).toBe(400);
    // Body depends on how ErrorHandler serializes ValidationError; document
    // the exact shape in Bruno when the route lands (#83).
  });

  // ---------- Concurrency ----------

  it("never exceeds slots under concurrent enrollments", async () => {
    // 5 students race for 2 slots through the whole HTTP stack: exactly 2
    // must get 201, the rest a clean 409 — never a 500.
    const { activity } = await anOpenActivity(2);
    const students = await Promise.all([
      createStudent(),
      createStudent(),
      createStudent(),
      createStudent(),
      createStudent(),
    ]);

    const results = await Promise.allSettled(
      students.map((s) =>
        request(app).post(enrollUrl(activity.id)).set(...authHeader(s.token)),
      ),
    );

    let created = 0;
    let conflicts = 0;
    for (const result of results) {
      if (result.status !== "fulfilled") throw result.reason;
      if (result.value.status === 201) created++;
      else if (result.value.status === 409) conflicts++;
      else throw new Error(`Unexpected status ${result.value.status}`);
    }
    expect(created).toBe(2);
    expect(conflicts).toBe(3);

    const approved = await prisma.enrollment.count({
      where: { activityId: activity.id, status: "APPROVED" },
    });
    expect(approved).toBe(2);
  });
});