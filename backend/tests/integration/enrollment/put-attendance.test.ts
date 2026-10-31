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
import { authCookie, invalidToken, signToken } from "../../helpers/auth.js";

// Route contract: docs/bruno/Enrollments/Confirm Attendance.yml.
const attendanceUrl = (enrollmentId: string) =>
  `/enrollments/${enrollmentId}/attendance`;

const oldAttendanceUrl = (activityId: string, enrollmentId: string) =>
  `/activities/${activityId}/enrollments/${enrollmentId}/attendance`;

const CANONICAL_ENROLLMENT_KEYS = [
  "activityId",
  "attendanceConfirmed",
  "confirmedWorkloadHours",
  "createdAt",
  "id",
  "status",
  "updatedAt",
  "userId",
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

describe("PUT /enrollments/:enrollmentId/attendance", () => {
  // ---------- 200 - Success ----------

  it("homologates presence for the activity creator and returns canonical enrollment", async () => {
    const { author, activity, volunteer, enrollment } =
      await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: enrollment.id,
      activityId: activity.id,
      userId: volunteer.user.id,
      status: "APPROVED",
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });
  });

  it("returns the same result to a manager who is not the creator", async () => {
    const { activity, volunteer, enrollment } = await aHomologableEnrollment();
    const manager = await createManager();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(manager.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: enrollment.id,
      activityId: activity.id,
      userId: volunteer.user.id,
      status: "APPROVED",
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("accepts the creator authenticated via session cookie", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(response.body.attendanceConfirmed).toBe(true);
  });

  it("registers an absence with attended=false, forcing the hours to 0", async () => {
    const { author, activity, volunteer, enrollment } =
      await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: enrollment.id,
      activityId: activity.id,
      userId: volunteer.user.id,
      status: "APPROVED",
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
      createdAt: expect.any(String),
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
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 6 });

    expect(response.status).toBe(200);
    expect(response.body.confirmedWorkloadHours).toBe(6);
    await expect(
      prisma.enrollment.count({ where: { activityId: activity.id } }),
    ).resolves.toBe(1);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 6,
    });
  });

  it("corrects a presence into an absence, zeroing the hours", async () => {
    const { author, enrollment } = await aHomologableEnrollment(
      {},
      { attendanceConfirmed: true, confirmedWorkloadHours: 4 },
    );

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
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
      const { author, enrollment } = await aHomologableEnrollment();

      const response = await request(app)
        .put(attendanceUrl(enrollment.id))
        .set(...authCookie(author.token))
        .send({ attended: true, workloadHours });

      expect(response.status).toBe(200);
      expect(response.body.confirmedWorkloadHours).toBe(workloadHours);
    },
  );

  it("advances updatedAt on the homologated enrollment", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(
      enrollment.updatedAt.getTime(),
    );
  });

  it("exposes all canonical enrollment fields and nothing else", async () => {
    const { author, volunteer, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(
      CANONICAL_ENROLLMENT_KEYS.sort(),
    );
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain(
      volunteer.user.passwordHash,
    );
    expect(JSON.stringify(response.body)).not.toContain(volunteer.user.email);
  });

  // ---------- Old Route 404 ----------

  it("answers 404 on the old route path with PATCH", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .patch(oldAttendanceUrl(activity.id, enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
  });

  it("answers 404 on the old route path with PUT", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(oldAttendanceUrl(activity.id, enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
  });

  // ---------- 400 - Bad Request (body shape & cross-field rules) ----------

  it("returns 400 when attended has the wrong type, naming the field", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
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
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "attended" }),
    ]);
  });

  it("returns 400 when workloadHours is not a number", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: "4" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "workloadHours" }),
    ]);
  });

  it("returns 400 with field: 'workloadHours' in errors[] when attended is false and workloadHours is present", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: false, workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      expect.objectContaining({
        field: "workloadHours",
        code: "VALIDATION_ERROR",
        message: "workloadHours must be omitted when attended is false.",
      }),
    ]);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 400 with field: 'workloadHours' in errors[] when attended is true without workloadHours", async () => {
    const { author, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      expect.objectContaining({
        field: "workloadHours",
        code: "VALIDATION_ERROR",
        message: "workloadHours is required when attended is true.",
      }),
    ]);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("rejects any extra field in the body — the target never travels in the body", async () => {
    const { author, volunteer, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4, userId: volunteer.user.id });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      {
        field: "",
        code: "VALIDATION_ERROR",
        message: 'Unrecognized key: "userId"',
      },
    ]);
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without any credential", async () => {
    const { enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "No token provided.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("rejects an invalid session cookie", async () => {
    const { enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(invalidToken()))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Token malformatted, expired or invalid.",
    });
  });

  it("rejects an invalid session cookie", async () => {
    const { enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(invalidToken()))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { author, enrollment } = await aHomologableEnrollment();
    const expired = signToken(
      { id: author.user.id, userType: "TEACHER", isManager: false },
      "-1h",
    );

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(expired))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { enrollment } = await aHomologableEnrollment();
    const ghost = await createManager();
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(ghost.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "User account not found or inactive.",
    });
  });

  // ---------- 403 - Forbidden ----------

  it("forbids an authenticated user who is neither the creator nor a manager", async () => {
    const { enrollment } = await aHomologableEnrollment();
    const outsider = await createTeacher();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(outsider.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "Only the activity creator or a manager can confirm attendance.",
    });
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("forbids the enrolled volunteer from homologating their own attendance", async () => {
    const { volunteer, enrollment } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(volunteer.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(403);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  // ---------- 404 - Not Found ----------

  it("returns 404 for an enrollment that does not exist", async () => {
    const { author } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(randomUUID()))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Enrollment not found.",
    });
  });

  it("returns the enrollment 404 when its activity was soft-deleted", async () => {
    const { author, activity, enrollment } = await aHomologableEnrollment();
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Enrollment not found.",
    });
    // Soft delete hides the activity but preserves the attendance data.
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
    });
  });

  it("returns 404 for a non-UUID enrollmentId", async () => {
    const { author } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl("not-a-uuid"))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Enrollment not found.",
    });
  });

  // ---------- 409 - Conflict ----------

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "returns 409 on a %s activity — only completed actions grant hours",
    async (status) => {
      const { author, enrollment } = await aHomologableEnrollment({
        status,
      });

      const response = await request(app)
        .put(attendanceUrl(enrollment.id))
        .set(...authCookie(author.token))
        .send({ attended: true, workloadHours: 4 });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        code: "ACTIVITY_NOT_COMPLETED",
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
      const { author, enrollment } = await aHomologableEnrollment(
        {},
        { status },
      );

      const response = await request(app)
        .put(attendanceUrl(enrollment.id))
        .set(...authCookie(author.token))
        .send({ attended: true, workloadHours: 4 });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 409,
        code: "ENROLLMENT_NOT_APPROVED",
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
      const { author, enrollment } = await aHomologableEnrollment();

      const response = await request(app)
        .put(attendanceUrl(enrollment.id))
        .set(...authCookie(author.token))
        .send({ attended: true, workloadHours });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        status: 422,
        code: "UNPROCESSABLE",
        message:
          "workloadHours must be an integer between 1 and the activity's workload hours.",
      });
      await expect(attendanceOf(enrollment.id)).resolves.toEqual({
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      });
    },
  );

  it("keeps a previous homologation untouched when the correction is rejected", async () => {
    const { author, enrollment } = await aHomologableEnrollment(
      {},
      { attendanceConfirmed: true, confirmedWorkloadHours: 4 },
    );

    const response = await request(app)
      .put(attendanceUrl(enrollment.id))
      .set(...authCookie(author.token))
      .send({ attended: true, workloadHours: WORKLOAD_HOURS + 1 });

    expect(response.status).toBe(422);
    await expect(attendanceOf(enrollment.id)).resolves.toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });
  });

  // ---------- Validation order ----------

  it("answers 401 (not 404) to an unauthenticated request on a nonexistent enrollment", async () => {
    const response = await request(app)
      .put(attendanceUrl(randomUUID()))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("answers 401 (not 404) to an unauthenticated request with a malformed id", async () => {
    const response = await request(app)
      .put(attendanceUrl("not-a-uuid"))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(401);
  });

  it("answers 400 (not 404) to an invalid combination on a nonexistent enrollment", async () => {
    const { author } = await aHomologableEnrollment();

    const response = await request(app)
      .put(attendanceUrl(randomUUID()))
      .set(...authCookie(author.token))
      .send({ attended: false, workloadHours: 4 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "workloadHours" }),
    ]);
  });

  it("answers 404 (not 403) to an unauthorized user on a nonexistent enrollment", async () => {
    const outsider = await createTeacher();

    const response = await request(app)
      .put(attendanceUrl(randomUUID()))
      .set(...authCookie(outsider.token))
      .send({ attended: true, workloadHours: 4 });

    expect(response.status).toBe(404);
  });
});
