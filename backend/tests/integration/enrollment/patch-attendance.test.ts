import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createEnrollment,
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import {
  authCookie,
  authHeader,
  invalidToken,
  signToken,
} from "../../helpers/auth.js";

// Route contract: docs/bruno/Enrollments/Confirm Attendance.yml.
const attendanceUrl = (activityId: string, enrollmentId: string) =>
  `/activities/${activityId}/enrollments/${enrollmentId}/attendance`;

const ATTENDANCE_KEYS = [
  "attendanceConfirmed",
  "confirmedWorkloadHours",
  "updatedAt",
];

const WORKLOAD_HOURS = 20;

/**
 * The only state in which homologation is allowed: COMPLETED activity,
 * APPROVED enrollment, nothing homologated yet.
 */
async function aHomologableEnrollment(
  activityOverrides: Parameters<typeof createActivity>[1] = {},
  enrollmentOverrides: Parameters<typeof createEnrollment>[2] = {},
) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, {
    status: "COMPLETED",
    workloadHours: WORKLOAD_HOURS,
    ...activityOverrides,
  });
  const volunteer = await createStudent();
  const enrollment = await createEnrollment(
    volunteer.user.id,
    activity.id,
    enrollmentOverrides,
  );

  return { author, activity, volunteer, enrollment };
}

function attendanceOf(enrollmentId: string) {
  return prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: { attendanceConfirmed: true, confirmedWorkloadHours: true },
  });
}

describe("PATCH /activities/:activityId/enrollments/:enrollmentId/attendance", () => {
  // ---------- 200 - Success ----------

  it("homologates presence for the activity creator and persists the pair", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
      updatedAt: expect.any(String),
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });
  });

  it("returns the same result to a manager who is not the creator", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    const manager = await createManager();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(manager.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
      updatedAt: expect.any(String),
    });
  });

  it("accepts the creator authenticated via session cookie", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body.attendanceConfirmed).toBe(true);
  });

  it("registers an absence with attended=false, forcing the hours to 0", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
      updatedAt: expect.any(String),
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
    });
  });

  it("overwrites a previous homologation and keeps a single attendance state", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment(
      {},
      { attendanceConfirmed: true, confirmedWorkloadHours: 4 },
    );

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 6 });

    expect(response.status).toBe(200); // never 201: correction is not a creation
    expect(response.body.confirmedWorkloadHours).toBe(6);
    // Attendance lives on the enrollment itself, so a correction cannot
    // duplicate it — the row count is the structural guarantee.
    await expect(
      prisma.enrollment.count({ where: { activityId: activity.id } }),
    ).resolves.toBe(1);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 6,
    });
  });

  it("corrects a presence into an absence, zeroing the hours", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment(
      {},
      { attendanceConfirmed: true, confirmedWorkloadHours: 4 },
    );

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: false });

    expect(response.status).toBe(200);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
    });
  });

  it.each([1, WORKLOAD_HOURS])(
    "accepts %i hours — both interval limits are inclusive",
    async (workloadHours) => {
      const { author, activity, enrollment } = await aHomologableEnrollment();

      const response = await request(app)
        .patch(attendanceUrl(activity.id, enrollment.id))
        .set(...authHeader(author.token))
        .send({ attended: true, workloadHours });

      expect(response.status).toBe(200);
      expect(response.body.confirmedWorkloadHours).toBe(workloadHours);
    },
  );

  it("advances updatedAt on the homologated enrollment", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(
      enrollment.updatedAt.getTime(),
    );
  });

  it("exposes only the attendance DTO — no volunteer data, no database internals", async () => {
    const { author, activity, volunteer, enrollment } =
      await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(ATTENDANCE_KEYS);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain(
      volunteer.user.passwordHash,
    );
    expect(JSON.stringify(response.body)).not.toContain(volunteer.user.email);
  });

  // ---------- 400 - Bad Request (shape of body and path params) ----------

  it("returns 400 when attended has the wrong type, naming the field", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: "yes", workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "attended" }),
    ]);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 400 when attended is missing", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "attended" }),
    ]);
  });

  it("returns 400 when workloadHours is not a number", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: "4" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "workloadHours" }),
    ]);
  });

  it("rejects any extra field in the body — the target never travels in the body", async () => {
    const { author, activity, volunteer, enrollment } =
      await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4, userId: volunteer.user.id });

    expect(response.status).toBe(400);
    // The unknown key belongs to the object, not to a property, so Zod has no
    // path for it and `field` comes out empty — documented as such.
    expect(response.body.errors).toEqual([
      { field: "", message: 'Unrecognized key: "userId"' },
    ]);
  });

  it("returns 400 for a non-UUID activityId, naming the parameter", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl("not-a-uuid", enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      { field: "activityId", message: "activityId must be a valid UUID." },
    ]);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 400 for a non-UUID enrollmentId, naming the parameter", async () => {
    const { author, activity } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, "not-a-uuid"))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "enrollmentId", message: "enrollmentId must be a valid UUID." },
    ]);
  });

  it("names every malformed path parameter, not just the first", async () => {
    const { author } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl("not-a-uuid", "also-not-a-uuid"))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "activityId", message: "activityId must be a valid UUID." },
      { field: "enrollmentId", message: "enrollmentId must be a valid UUID." },
    ]);
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without any credential", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "No token provided.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("rejects an invalid Bearer token", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(invalidToken()))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "Token malformatted, expired or invalid.",
    });
  });

  it("rejects an invalid session cookie", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authCookie(invalidToken()))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();
    const expired = signToken(
      { id: author.user.id, userType: "TEACHER", isManager: false },
      "-1h",
    );

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(expired))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    const ghost = await createManager();
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(ghost.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "User account not found or inactive.",
    });
  });

  // ---------- 403 - Forbidden ----------

  it("forbids an authenticated user who is neither the creator nor a manager", async () => {
    const { activity, enrollment } = await aHomologableEnrollment();
    const outsider = await createTeacher();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(outsider.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "Only the activity creator or a manager can confirm attendance.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("forbids the enrolled volunteer from homologating their own attendance", async () => {
    const { activity, volunteer, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(volunteer.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(403);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  // ---------- 404 - Not Found ----------

  it("returns 404 for a nonexistent activity", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(randomUUID(), enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      message: "Activity not found.",
    });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    // Soft delete hides the activity but preserves the attendance data.
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 404 for an enrollment that does not exist", async () => {
    const { author, activity } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, randomUUID()))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      message: "Enrollment not found.",
    });
  });

  it("returns 404 for an enrollment that belongs to another activity", async () => {
    const { author, activity } = await aHomologableEnrollment();
    const other = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, other.enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    // Same answer as a nonexistent enrollment: the existence of other
    // activities' enrollments is never revealed.
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      message: "Enrollment not found.",
    });
    await expect(attendanceOf(other.enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  // ---------- 409 - Conflict ----------

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "returns 409 on a %s activity — only completed actions grant hours",
    async (status) => {
      const { author, activity, enrollment } = await aHomologableEnrollment({
        status,
      });

      const response = await request(app)
        .patch(attendanceUrl(activity.id, enrollment.id))
        .set(...authHeader(author.token))
        .send({ attended: true, workloadHours: 4 });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        message: "Attendance can only be confirmed for completed activities.",
      });
      await expect(attendanceOf(enrollment.id)).resolves.toEqual({
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      });
    },
  );

  it.each(["CANCELLED", "PENDING", "REJECTED"] as const)(
    "returns 409 for a %s enrollment",
    async (status) => {
      const { author, activity, enrollment } = await aHomologableEnrollment(
        {},
        { status },
      );

      const response = await request(app)
        .patch(attendanceUrl(activity.id, enrollment.id))
        .set(...authHeader(author.token))
        .send({ attended: true, workloadHours: 4 });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        message: "Only approved enrollments can have attendance confirmed.",
      });
      await expect(attendanceOf(enrollment.id)).resolves.toEqual({
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      });
    },
  );

  // ---------- 422 - Unprocessable Entity ----------

  it.each([0, -1, 4.5, WORKLOAD_HOURS + 1])(
    "returns 422 for %s hours and changes nothing",
    async (workloadHours) => {
      const { author, activity, enrollment } = await aHomologableEnrollment();

      const response = await request(app)
        .patch(attendanceUrl(activity.id, enrollment.id))
        .set(...authHeader(author.token))
        .send({ attended: true, workloadHours });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        status: 422,
        message:
          "workloadHours must be an integer between 1 and the activity's workload hours.",
      });
      await expect(attendanceOf(enrollment.id)).resolves.toEqual({
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      });
    },
  );

  it("returns 422 when attended is true without workloadHours", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 422,
      message: "workloadHours is required when attended is true.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 422 when attended is false and workloadHours is present", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: false, workloadHours: 4 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      status: 422,
      message: "workloadHours must be omitted when attended is false.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("keeps a previous homologation untouched when the correction is rejected", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment(
      {},
      { attendanceConfirmed: true, confirmedWorkloadHours: 4 },
    );

    const response = await request(app)
      .patch(attendanceUrl(activity.id, enrollment.id))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: WORKLOAD_HOURS + 1 });

    expect(response.status).toBe(422);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });
  });

  // ---------- Validation order ----------

  it("answers 401 (not 404) to an unauthenticated request on a nonexistent activity", async () => {
    const { enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(attendanceUrl(randomUUID(), enrollment.id))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("answers 401 (not 400) to an unauthenticated request with a malformed id", async () => {
    const response = await request(app)
      .patch(attendanceUrl("not-a-uuid", "not-a-uuid"))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("answers 404 (not 403) to an unauthorized user on a nonexistent activity", async () => {
    const { enrollment } = await aHomologableEnrollment();
    const outsider = await createTeacher();

    const response = await request(app)
      .patch(attendanceUrl(randomUUID(), enrollment.id))
      .set(...authHeader(outsider.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
  });

  it("answers 404 (not 409) for a nonexistent enrollment on a non-completed activity", async () => {
    const { author, activity } = await aHomologableEnrollment({
      status: "OPEN",
    });

    const response = await request(app)
      .patch(attendanceUrl(activity.id, randomUUID()))
      .set(...authHeader(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
  });
});
