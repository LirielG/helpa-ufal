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
import { authCookie, invalidToken } from "../../helpers/auth.js";

const enrollUrl = (activityId: string) =>
  `/activities/${activityId}/enrollments/me`;

async function anOpenActivity(slots = 30) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, { slots });
  return { author, activity };
}

describe("PUT /activities/:activityId/enrollments/me", () => {
  // ---------- 201 - Created ----------

  it("creates an APPROVED enrollment for the authenticated user", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      activityId: activity.id,
      userId: student.user.id,
      status: "APPROVED",
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
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
      confirmedWorkloadHours: 8,
    });

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(canceled.id);
    // Contract decision: createdAt is the record's ORIGINAL creation date.
    expect(response.body.createdAt).toBe(canceled.createdAt.toISOString());

    const stored = await prisma.enrollment.findUniqueOrThrow({
      where: { id: canceled.id },
    });
    expect(stored.status).toBe("APPROVED");
    expect(stored.attendanceConfirmed).toBeNull();
    expect(stored.confirmedWorkloadHours).toBe(0);
    expect(stored.enrolledAt.getTime()).toBeGreaterThan(
      new Date("2026-01-01T00:00:00.000Z").getTime(),
    );

    const rows = await prisma.enrollment.count({
      where: { userId: student.user.id, activityId: activity.id },
    });
    expect(rows).toBe(1);
    const repeated = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(response.body);
  });

  it("immediately consumes a slot in the activity detail", async () => {
    const { author, activity } = await anOpenActivity(2);
    const student = await createStudent();

    await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token))
      .expect(201);

    const detail = await request(app)
      .get(`/activities/${activity.id}`)
      .set(...authCookie(author.token));

    expect(detail.status).toBe(200);
    expect(detail.body.availableSlots).toBe(1);
  });

  it("ignores any userId sent in the request body and enrolls the token's user", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    const other = await createStudent();

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token))
      .send({ userId: other.user.id });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBe(student.user.id);
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without a token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app).put(enrollUrl(activity.id));

    expect(response.status).toBe(401);
    // Message is owned by AuthMiddleware ("No token provided.") and predates
    // the contract's "Unauthenticated." — assert only the status until the
    // team aligns middleware vs contract.
  });

  it("rejects an invalid or expired token", async () => {
    const { activity } = await anOpenActivity();

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { activity } = await anOpenActivity();
    const ghost = await createStudent();
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(ghost.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "SESSION_INVALID",
      message: "Session is no longer valid.",
    });
  });

  // ---------- 404 - Not Found ----------

  it("returns 404 for a nonexistent activity", async () => {
    const student = await createStudent();

    const response = await request(app)
      .put(enrollUrl(randomUUID()))
      .set(...authCookie(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found.",
    });
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
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found.",
    });
  });

  // ---------- 409 - Conflict ----------

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "returns 409 when the activity status is %s",
    async (status) => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status });
      const student = await createStudent();

      const response = await request(app)
        .put(enrollUrl(activity.id))
        .set(...authCookie(student.token));

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        code: "ACTIVITY_NOT_OPEN_FOR_ENROLLMENT",
        message: "Activity is not open for enrollment.",
      });
    },
  );

  it("returns the same enrollment without writing when it already occupies the last slot", async () => {
    const { activity } = await anOpenActivity(1);
    const student = await createStudent();
    const first = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token))
      .expect(201);
    const before = await prisma.enrollment.findUniqueOrThrow({
      where: { id: first.body.id },
    });

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(first.body);
    const after = await prisma.enrollment.findUniqueOrThrow({
      where: { id: first.body.id },
    });
    expect(after).toEqual(before);
    expect(
      await prisma.enrollment.count({
        where: { userId: student.user.id, activityId: activity.id },
      }),
    ).toBe(1);
  });

  it("returns 409 when the activity has no available slots", async () => {
    const { activity } = await anOpenActivity(1);
    const first = await createStudent();
    const second = await createStudent();
    await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(first.token))
      .expect(201);

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(second.token));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      code: "NO_AVAILABLE_SLOTS",
      message: "No available slots for this activity.",
    });
  });

  it.each(["PENDING", "REJECTED", "APPROVED"] as const)(
    "preserves every field of an existing %s enrollment",
    async (status) => {
      const { activity } = await anOpenActivity(1);
      const student = await createStudent();
      const before = await createEnrollment(student.user.id, activity.id, {
        status,
        attendanceConfirmed: true,
        confirmedWorkloadHours: 8,
        isModerator: true,
        enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const response = await request(app)
        .put(enrollUrl(activity.id))
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: before.id,
        activityId: activity.id,
        userId: student.user.id,
        status,
        attendanceConfirmed: true,
        confirmedWorkloadHours: 8,
        createdAt: before.createdAt.toISOString(),
        updatedAt: before.updatedAt.toISOString(),
      });
      expect(
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: before.id },
        }),
      ).toEqual(before);
    },
  );

  it("keeps a cancelled enrollment unchanged when reactivation has no slot", async () => {
    const { activity } = await anOpenActivity(1);
    const student = await createStudent();
    const cancelled = await createEnrollment(student.user.id, activity.id, {
      status: "CANCELLED",
    });
    const other = await createStudent();
    await createEnrollment(other.user.id, activity.id);

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("NO_AVAILABLE_SLOTS");
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: cancelled.id },
      }),
    ).toEqual(cancelled);
  });

  it("rejects an existing enrollment when the activity is closed", async () => {
    const { activity } = await anOpenActivity();
    const student = await createStudent();
    const before = await createEnrollment(student.user.id, activity.id);
    await prisma.activity.update({
      where: { id: activity.id },
      data: { status: "IN_PROGRESS" },
    });

    const response = await request(app)
      .put(enrollUrl(activity.id))
      .set(...authCookie(student.token));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ACTIVITY_NOT_OPEN_FOR_ENROLLMENT");
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: before.id },
      }),
    ).toEqual(before);
  });

  it("rejects a malformed activity id after authentication", async () => {
    const student = await createStudent();
    const response = await request(app)
      .put(enrollUrl("not-a-uuid"))
      .set(...authCookie(student.token));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.errors).toContainEqual({
      field: "activityId",
      code: "INVALID_UUID",
      message: "activityId must be a valid UUID.",
    });
  });

  it.each(["post", "delete"] as const)(
    "returns 404 for the removed %s enrollment route",
    async (method) => {
      const { activity } = await anOpenActivity();
      const student = await createStudent();
      await request(app)
        [method](`/activities/${activity.id}/enroll`)
        .set(...authCookie(student.token))
        .expect(404);
    },
  );

  it("creates once and returns the same body to concurrent requests from one user", async () => {
    const { activity } = await anOpenActivity(1);
    const student = await createStudent();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .put(enrollUrl(activity.id))
          .set(...authCookie(student.token)),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 200, 200, 200, 201,
    ]);
    const created = responses.find((response) => response.status === 201)!;
    for (const response of responses)
      expect(response.body).toEqual(created.body);
    expect(
      await prisma.enrollment.count({
        where: { userId: student.user.id, activityId: activity.id },
      }),
    ).toBe(1);
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
        request(app)
          .put(enrollUrl(activity.id))
          .set(...authCookie(s.token)),
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
