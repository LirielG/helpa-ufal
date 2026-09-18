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
import { authCookie, authHeader, invalidToken } from "../../helpers/auth.js";

// Route contract: docs/bruno/Enrollments/List Activity Enrollments.yml.
const listUrl = (activityId: string) => `/activities/${activityId}/enrollments`;

async function anActivityWithAuthor(overrides = {}) {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, overrides);
  return { author, activity };
}

const PARTICIPANT_KEYS = [
  "attendanceConfirmed",
  "confirmedWorkloadHours",
  "email",
  "enrollmentId",
  "fullName",
  "registrationCode",
  "status",
  "userId",
];

describe("GET /activities/:activityId/enrollments", () => {
  // ---------- 200 - Success ----------

  it("returns the paginated list of APPROVED enrollments to the activity creator (Bearer)", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const enrolled = await createStudent({
      fullName: "Maria Clara Santos",
      registrationCode: "20240012345",
    });
    await createEnrollment(enrolled.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          enrollmentId: expect.any(String),
          userId: enrolled.user.id,
          fullName: "Maria Clara Santos",
          email: enrolled.user.email,
          registrationCode: "20240012345",
          status: "APPROVED",
          attendanceConfirmed: null,
          confirmedWorkloadHours: 0,
        },
      ],
      total: 1,
      page: 1, // default
      limit: 10, // default
      totalPresent: 0,
    });
  });

  it("returns the same result to the creator authenticated via session cookie", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const enrolled = await createStudent();
    await createEnrollment(enrolled.user.id, activity.id);

    const viaBearer = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));
    const viaCookie = await request(app)
      .get(listUrl(activity.id))
      .set(...authCookie(author.token));

    expect(viaCookie.status).toBe(200);
    expect(viaCookie.body).toEqual(viaBearer.body);
  });

  it("returns the identical payload to a manager who is not the creator", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const manager = await createManager();
    const enrolled = await createStudent();
    await createEnrollment(enrolled.user.id, activity.id);

    const asCreator = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));
    const asManager = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(manager.token));

    expect(asCreator.status).toBe(200);
    expect(asManager.status).toBe(200);
    expect(asManager.body).toEqual(asCreator.body);
  });

  it("hides CANCELLED enrollments from items, total and totalPresent", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const active = await createStudent();
    const canceled = await createStudent();
    await createEnrollment(active.user.id, activity.id);
    // Even with attendance data, a CANCELLED row must count for nothing.
    await createEnrollment(canceled.user.id, activity.id, {
      status: "CANCELLED",
      attendanceConfirmed: true,
      confirmedWorkloadHours: 5,
    });

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].userId).toBe(active.user.id);
    expect(response.body.total).toBe(1);
    expect(response.body.totalPresent).toBe(0);
  });

  it("counts only attendanceConfirmed = true in totalPresent; registered absences do not count", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const present = await createStudent();
    const absent = await createStudent();
    const pending = await createStudent();
    await createEnrollment(present.user.id, activity.id, {
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });
    await createEnrollment(absent.user.id, activity.id, {
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
    });
    await createEnrollment(pending.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.totalPresent).toBe(1);
    expect(response.body.items).toContainEqual(
      expect.objectContaining({
        userId: present.user.id,
        attendanceConfirmed: true,
        confirmedWorkloadHours: 4,
      }),
    );
    expect(response.body.items).toContainEqual(
      expect.objectContaining({
        userId: absent.user.id,
        attendanceConfirmed: false,
        confirmedWorkloadHours: 0,
      }),
    );
    expect(response.body.items).toContainEqual(
      expect.objectContaining({
        userId: pending.user.id,
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      }),
    );
  });

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "shows null/0 presence on a %s activity (structural state, no code branch)",
    async (status) => {
      const { author, activity } = await anActivityWithAuthor({ status });
      const enrolled = await createStudent();
      await createEnrollment(enrolled.user.id, activity.id);

      const response = await request(app)
        .get(listUrl(activity.id))
        .set(...authHeader(author.token));

      expect(response.status).toBe(200);
      expect(response.body.items[0].attendanceConfirmed).toBeNull();
      expect(response.body.items[0].confirmedWorkloadHours).toBe(0);
    },
  );

  it("returns registrationCode null for an enrolled professor (only Student.registrationCode is exposed)", async () => {
    const { author, activity } = await anActivityWithAuthor();
    // createTeacher() DOES write Teacher.registrationCode in the database —
    // the API omits it by data minimization.
    const professor = await createTeacher({ registrationCode: "SIAPE-12345" });
    await createEnrollment(professor.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.items[0].registrationCode).toBeNull();
  });

  it("returns 200 with an empty envelope when the activity has no active enrollments", async () => {
    const { author, activity } = await anActivityWithAuthor();

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200); // never 404 for lack of enrollees
    expect(response.body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPresent: 0,
    });
  });

  it("returns 200 with an empty envelope when every enrollment is CANCELLED", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const canceled = await createStudent();
    await createEnrollment(canceled.user.id, activity.id, { status: "CANCELLED" });

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.body.totalPresent).toBe(0);
  });

  it("orders items by enrolledAt ascending (oldest enrollment first)", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const newest = await createStudent();
    const oldest = await createStudent();
    const middle = await createStudent();
    await createEnrollment(newest.user.id, activity.id, {
      enrolledAt: new Date("2026-01-03T10:00:00.000Z"),
    });
    await createEnrollment(oldest.user.id, activity.id, {
      enrolledAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    await createEnrollment(middle.user.id, activity.id, {
      enrolledAt: new Date("2026-01-02T10:00:00.000Z"),
    });

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: { userId: string }) => i.userId)).toEqual([
      oldest.user.id,
      middle.user.id,
      newest.user.id,
    ]);
  });

  it("paginates with page and limit while total stays global", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const students = await Promise.all([
      createStudent(),
      createStudent(),
      createStudent(),
      createStudent(),
      createStudent(),
    ]);
    for (const [index, student] of students.entries()) {
      await createEnrollment(student.user.id, activity.id, {
        enrolledAt: new Date(Date.UTC(2026, 0, index + 1)),
      });
    }

    const response = await request(app)
      .get(`${listUrl(activity.id)}?page=3&limit=2`)
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(3);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBe(5); // total is not affected by pagination
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].userId).toBe(students[4].user.id);
  });

  it("never exposes passwordHash or any field outside the DTO", async () => {
    const { author, activity } = await anActivityWithAuthor();
    const enrolled = await createStudent();
    await createEnrollment(enrolled.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain(enrolled.user.passwordHash);
    for (const item of response.body.items) {
      expect(Object.keys(item).sort()).toEqual(PARTICIPANT_KEYS);
    }
  });

  // ---------- 400 - Bad Request (query validated before auth) ----------

  it.each([
    ["page=abc", "page", "page must be a positive integer."],
    ["page=0", "page", "page must be a positive integer."],
    ["page=-1", "page", "page must be a positive integer."],
    ["limit=abc", "limit", "limit must be a positive integer."],
    ["limit=0", "limit", "limit must be a positive integer."],
    ["limit=51", "limit", "limit must be at most 50."],
  ] as const)(
    "returns 400 for %s naming the offending field",
    async (queryString, field, message) => {
      const { author, activity } = await anActivityWithAuthor();

      const response = await request(app)
        .get(`${listUrl(activity.id)}?${queryString}`)
        .set(...authHeader(author.token));

      expect(response.status).toBe(400);
      expect(response.body.status).toBe(400);
      expect(response.body.message).toBe("Invalid query parameters.");
      expect(response.body.errors).toEqual([{ field, message }]);
    },
  );

  it("returns 400 for an invalid query even without credentials (validation precedes auth)", async () => {
    const { activity } = await anActivityWithAuthor();

    const response = await request(app).get(`${listUrl(activity.id)}?page=abc`);

    expect(response.status).toBe(400);
  });

  // ---------- 401 - Unauthorized ----------

  it("rejects requests without any credential", async () => {
    const { activity } = await anActivityWithAuthor();

    const response = await request(app).get(listUrl(activity.id));

    expect(response.status).toBe(401);
    // Message is owned by AuthMiddleware and predates the contract's
    // "Unauthenticated." — assert only the status until the team aligns them.
  });

  it("rejects an invalid Bearer token", async () => {
    const { activity } = await anActivityWithAuthor();

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects an invalid session cookie", async () => {
    const { activity } = await anActivityWithAuthor();

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authCookie(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { activity } = await anActivityWithAuthor();
    const ghost = await createStudent();
    await prisma.user.delete({ where: { id: ghost.user.id } });

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(ghost.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      message: "User account not found or inactive.",
    });
  });

  // ---------- 404 - Not Found ----------

  it("returns 404 for a nonexistent activity", async () => {
    const user = await createStudent();

    const response = await request(app)
      .get(listUrl(randomUUID()))
      .set(...authHeader(user.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const { author, activity } = await anActivityWithAuthor();
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(author.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 — not 400 — for a non-UUID activity id", async () => {
    // Contract decision for THIS route: identifiers in the path are resource
    // lookups, never operator input. NOTE: DELETE /activities/:id/enroll
    // returns 400 for the same input today; the team must reconcile the two.
    const user = await createStudent();

    const response = await request(app)
      .get(listUrl("not-a-uuid"))
      .set(...authHeader(user.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  // ---------- Validation order ----------

  it("returns 401 (not 404) for an unauthenticated request to a nonexistent activity", async () => {
    const response = await request(app).get(listUrl("b87c043e-5e00-4f98-b186-3843be61a4b1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 (not 403) for an authenticated non-authorized user on a nonexistent activity", async () => {
    const user = await createStudent();

    const response = await request(app)
      .get(listUrl(randomUUID()))
      .set(...authHeader(user.token));

    expect(response.status).toBe(404);
  });

  // ---------- 403 - Forbidden ----------

  it("returns 403 with no data for any authenticated user who is neither creator nor manager", async () => {
    const { activity } = await anActivityWithAuthor();
    const outsider = await createStudent();
    const enrolledData = await createStudent();
    await createEnrollment(enrolledData.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(outsider.token));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "Only the activity creator or a manager can view the enrollment list.",
    });
    expect(JSON.stringify(response.body)).not.toContain(enrolledData.user.email);
  });

  it("returns 403 even for a volunteer enrolled in the activity", async () => {
    const { activity } = await anActivityWithAuthor();
    const volunteer = await createStudent();
    await createEnrollment(volunteer.user.id, activity.id);

    const response = await request(app)
      .get(listUrl(activity.id))
      .set(...authHeader(volunteer.token));

    expect(response.status).toBe(403);
    expect(response.body.items).toBeUndefined();
  });
});
