import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createManager,
  createReport,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken } from "../../helpers/auth.js";

async function removeUser(userId: string): Promise<void> {
  await prisma.student.deleteMany({ where: { userId } });
  await prisma.teacher.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function anOpenReport() {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, { status: "OPEN" });
  const reporter = await createStudent({ fullName: "Maria Clara Santos" });
  const report = await createReport(activity.id, reporter.user.id);
  return { author, activity, reporter, report };
}

function resolve(reportId: string, token?: string) {
  const req = request(app).put(`/reports/${reportId}/resolution`);
  return token ? req.set(...authCookie(token)) : req;
}

describe("PUT /reports/:reportId/resolution", () => {
  // ---------- 200 ----------

  it("records the manager from the token and returns the report in the list format", async () => {
    const manager = await createManager();
    const { author, activity, reporter, report } = await anOpenReport();
    const before = Date.now();

    const response = await resolve(report.id, manager.token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: report.id,
      category: report.category,
      description: report.description,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: expect.stringMatching(/Z$/),
      activity: {
        id: activity.id,
        title: activity.title,
        authorId: author.user.id,
      },
      reporter: { id: reporter.user.id, fullName: "Maria Clara Santos" },
    });
    expect(Date.parse(response.body.resolvedAt)).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");

    const stored = await prisma.activityReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(stored.resolvedById).toBe(manager.user.id);
    expect(stored.resolvedAt?.toISOString()).toBe(response.body.resolvedAt);
  });

  it("is idempotent: resolving again keeps the first manager and resolvedAt", async () => {
    const first = await createManager();
    const second = await createManager();
    const { report } = await anOpenReport();

    const initial = await resolve(report.id, first.token);
    const repeated = await resolve(report.id, second.token);

    expect(initial.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(initial.body);

    const stored = await prisma.activityReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(stored.resolvedById).toBe(first.user.id);
  });

  it("does not touch the reported activity", async () => {
    const manager = await createManager();
    const { activity, report } = await anOpenReport();

    await resolve(report.id, manager.token);

    const stored = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });
    expect(stored.status).toBe("OPEN");
    expect(stored.deletedAt).toBeNull();
  });

  it("resolves a report whose reporter was removed, returning reporter null", async () => {
    const manager = await createManager();
    const { reporter, report } = await anOpenReport();
    await removeUser(reporter.user.id);

    const response = await resolve(report.id, manager.token);

    expect(response.status).toBe(200);
    expect(response.body.reporter).toBeNull();
  });

  // ---------- 400 / 404 ----------

  it("returns 400 INVALID_UUID for a malformed reportId", async () => {
    const manager = await createManager();

    const response = await resolve("not-a-uuid", manager.token);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Validation error.",
      errors: [
        {
          field: "reportId",
          code: "INVALID_UUID",
          message: "reportId must be a valid UUID.",
        },
      ],
    });
  });

  it("returns 404 for a well-formed id with no report", async () => {
    const manager = await createManager();

    const response = await resolve(randomUUID(), manager.token);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      message: "Report not found.",
    });
  });

  // ---------- 401 / 403, checked before existence ----------

  it("returns 401 without a token, even for a missing report", async () => {
    const response = await resolve(randomUUID());

    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const response = await resolve(randomUUID(), invalidToken());

    expect(response.status).toBe(401);
  });

  it("returns 401 for a valid token of a removed manager, even with a malformed id", async () => {
    const manager = await createManager();
    await removeUser(manager.user.id);

    const response = await resolve("not-a-uuid", manager.token);

    expect(response.status).toBe(401);
  });

  it("returns 403 to a non-manager for a missing report, without resolving anything", async () => {
    const student = await createStudent();
    const { report } = await anOpenReport();

    const missing = await resolve(randomUUID(), student.token);
    const existing = await resolve(report.id, student.token);

    expect(missing.status).toBe(403);
    expect(existing.status).toBe(403);
    expect(existing.body).toEqual({
      status: 403,
      message: "User is not a manager.",
    });

    const stored = await prisma.activityReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(stored.resolvedAt).toBeNull();
    expect(stored.resolvedById).toBeNull();
  });
});
