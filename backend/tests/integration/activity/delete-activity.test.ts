import { describe, it, expect } from "vitest"; // globals are disabled: explicit import
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createStudent, createTeacher, createManager, createActivity } from "../../helpers/factories.js";
import { authHeader, authCookie, invalidToken } from "../../helpers/auth.js";

describe("DELETE /activities/:id", () => {
  it("returns 204, fills deletedAt and keeps the row in the database", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    // Direct database query (bypasses the API): proves the "soft" in soft delete.
    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });

  it("makes the activity invisible to the read endpoints (2.5.1)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    await request(app).get(`/activities/${activity.id}`).expect(404);

    const list = await request(app).get("/activities").expect(200);
    const ids = list.body.activities.map((a: { id: string }) => a.id);
    expect(ids).not.toContain(activity.id);
  });

  it("returns 404 on a second deletion and preserves the original deletedAt", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const first = await prisma.activity.findUnique({ where: { id: activity.id } });

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(404);

    const second = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(second!.deletedAt).toEqual(first!.deletedAt);
  });

  it("returns 403 when the requester is neither the author nor a manager", async () => {
    const author = await createTeacher();
    const other = await createStudent();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(other.token))
      .expect(403);

    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row!.deletedAt).toBeNull(); // nothing was touched
  });

  it("returns 403 when the token belongs to a user that no longer exists", async () => {
    // End-to-end ghost user: the token is still cryptographically valid,
    // but the account was removed — it must not authorize anything.
    const author = await createTeacher();
    const ghost = await createStudent();
    const activity = await createActivity(author.user.id);

    await prisma.user.delete({ where: { id: ghost.user.id } }); // cascades the Student row

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(ghost.token))
      .expect(403);

    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row!.deletedAt).toBeNull();
  });

  it("returns 204 when a manager deletes another author's activity", async () => {
    const author = await createTeacher();
    const manager = await createManager();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(manager.token))
      .expect(204);
  });

  it("returns 401 with no token and with an invalid token", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app).delete(`/activities/${activity.id}`).expect(401);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(invalidToken()))
      .expect(401);
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const author = await createTeacher();

    await request(app)
      .delete("/activities/not-a-uuid")
      .set(...authHeader(author.token))
      .expect(400);
  });

  it("returns 404 for a valid UUID of a nonexistent activity", async () => {
    const author = await createTeacher();

    await request(app)
      .delete(`/activities/${randomUUID()}`)
      .set(...authHeader(author.token))
      .expect(404);
  });

  it("preserves linked enrollments after the soft delete (history intact)", async () => {
    // US 2.5: deleting must not destroy enrollment/attendance/certificate history.
    const author = await createTeacher();
    const student = await createStudent();
    const activity = await createActivity(author.user.id);

    // No Enrollment factory yet: create it directly via Prisma.
    const enrollment = await prisma.enrollment.create({
      data: { userId: student.user.id, activityId: activity.id, status: "APPROVED" },
    });

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const preserved = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    expect(preserved).not.toBeNull();
    expect(preserved!.status).toBe("APPROVED");
  });

  it("preserves linked reports after the soft delete", async () => {
    // ActivityReport has onDelete: Cascade — it would only fire on a PHYSICAL
    // delete. This test is the watchdog: if someone replaces softDelete with a
    // physical delete, the report disappears and this test screams.
    const author = await createTeacher();
    const reporter = await createStudent();
    const activity = await createActivity(author.user.id);

    const report = await prisma.activityReport.create({
      data: {
        activityId: activity.id,
        userId: reporter.user.id,
        category: "SPAM",
        description: "Test report.",
      },
    });

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const preserved = await prisma.activityReport.findUnique({ where: { id: report.id } });
    expect(preserved).not.toBeNull();
  });

  it("accepts cookie authentication (same result as Bearer)", async () => {
    // The middleware accepts cookie OR header. If cookie support ever breaks,
    // the frontend (which uses cookies with credentials) loses the delete.
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authCookie(author.token))
      .expect(204);
  });

  it("a student author can also delete their own activity", async () => {
    // US 2.5 says "the activity creator" — student OR teacher. The manager
    // test uses TEACHER; this one ensures a STUDENT author is not wrongly blocked.
    const author = await createStudent();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);
  });

  it("does not affect other activities from the same author", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { title: "Will be deleted" });
    const survivor = await createActivity(author.user.id, { title: "Must survive" });

    await request(app)
      .delete(`/activities/${target.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const list = await request(app).get("/activities").expect(200);
    const ids = list.body.activities.map((a: { id: string }) => a.id);
    expect(ids).toContain(survivor.id);
    expect(ids).not.toContain(target.id);
  });

  it("returns an empty body on 204, per the contract", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    const response = await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    expect(response.text).toBe(""); // Bruno: 204 with no body
  });
});