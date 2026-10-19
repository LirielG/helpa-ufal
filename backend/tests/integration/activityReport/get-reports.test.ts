import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createManager,
  createReport,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken, signToken } from "../../helpers/auth.js";
import { daysFromNow } from "../../helpers/dates.js";

async function removeUser(userId: string): Promise<void> {
  await prisma.student.deleteMany({ where: { userId } });
  await prisma.teacher.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function reportedActivity() {
  const author = await createTeacher();
  const activity = await createActivity(author.user.id, {
    title: "Oficina de Introdução à Programação",
  });
  return { author, activity };
}

describe("GET /reports", () => {
  // ---------- 200 ----------

  it("returns the open reports with the DTO fields only", async () => {
    const manager = await createManager();
    const { author, activity } = await reportedActivity();
    const reporter = await createStudent({ fullName: "Maria Clara Santos" });
    const report = await createReport(activity.id, reporter.user.id, {
      category: "MISINFORMATION",
      description: "O endereço informado está errado.",
    });

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          id: report.id,
          category: "MISINFORMATION",
          description: "O endereço informado está errado.",
          createdAt: report.createdAt.toISOString(),
          resolvedAt: null,
          activity: {
            id: activity.id,
            title: "Oficina de Introdução à Programação",
            authorId: author.user.id,
          },
          reporter: { id: reporter.user.id, fullName: "Maria Clara Santos" },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain(reporter.user.email);
  });

  it("returns 200 with an empty page when nothing was reported", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("filters by resolution, defaulting to open reports", async () => {
    const manager = await createManager();
    const { activity } = await reportedActivity();
    const open = await createReport(
      activity.id,
      (await createStudent()).user.id,
    );
    const resolved = await createReport(
      activity.id,
      (await createStudent()).user.id,
      { resolvedAt: new Date(), resolvedById: manager.user.id },
    );

    const ids = async (query: string) => {
      const response = await request(app)
        .get(`/reports${query}`)
        .set(...authCookie(manager.token));
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      return response.body.items.map((item: { id: string }) => item.id);
    };

    expect(await ids("")).toEqual([open.id]);
    expect(await ids("?resolved=false")).toEqual([open.id]);
    expect(await ids("?resolved=true")).toEqual([resolved.id]);
  });

  it("paginates newest first, with total and totalPages counting the whole filter", async () => {
    const manager = await createManager();
    const { activity } = await reportedActivity();
    const reports = [];
    for (let i = 0; i < 3; i++) {
      reports.push(
        await createReport(activity.id, (await createStudent()).user.id, {
          createdAt: daysFromNow(-3 + i),
        }),
      );
    }

    const response = await request(app)
      .get("/reports?page=2&limit=2")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      reports[0]!.id,
    ]);
  });

  it("returns an empty page beyond the last one, keeping total", async () => {
    const manager = await createManager();
    const { activity } = await reportedActivity();
    await createReport(activity.id, (await createStudent()).user.id);

    const response = await request(app)
      .get("/reports?page=5")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ items: [], total: 1, totalPages: 1 });
  });

  it("lists a report whose reporter was removed with reporter null", async () => {
    const manager = await createManager();
    const { activity } = await reportedActivity();
    const reporter = await createStudent();
    const report = await createReport(activity.id, reporter.user.id);
    await removeUser(reporter.user.id);

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: report.id,
      reporter: null,
    });
  });

  it("keeps listing reports of a soft-deleted activity", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      deletedAt: new Date(),
    });
    const report = await createReport(
      activity.id,
      (await createStudent()).user.id,
    );

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      report.id,
    ]);
  });

  // ---------- 400 ----------

  it.each([
    ["resolved=", "resolved", "resolved must be true or false."],
    ["resolved=yes", "resolved", "resolved must be true or false."],
    ["page=0", "page", "page must be a positive integer."],
    ["limit=101", "limit", "limit must be at most 100."],
  ])("returns 400 for ?%s", async (query, field, message) => {
    const manager = await createManager();

    const response = await request(app)
      .get(`/reports?${query}`)
      .set(...authCookie(manager.token));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid query parameters.",
      errors: [{ field, code: "VALIDATION_ERROR", message }],
    });
  });

  it("returns 400 UNKNOWN_PARAMETER for a parameter the route does not take", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get("/reports?status=OPEN")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      {
        field: "status",
        code: "UNKNOWN_PARAMETER",
        message: "status is not a supported query parameter.",
      },
    ]);
  });

  // ---------- 401 / 403 ----------

  it("returns 401 without a token, even with a malformed query", async () => {
    const response = await request(app).get("/reports?page=abc");

    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const response = await request(app)
      .get("/reports")
      .set(...authCookie(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const manager = await createManager();
    const expired = signToken(
      { id: manager.user.id, userType: "TEACHER", isManager: true },
      "-1s",
    );

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(expired));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a valid token of a removed manager", async () => {
    const manager = await createManager();
    await removeUser(manager.user.id);

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "User account not found or inactive.",
    });
  });

  it.each([
    ["student", createStudent],
    ["teacher", createTeacher],
  ])(
    "returns 403 to a %s who is not a manager, with no data",
    async (_, create) => {
      const { activity } = await reportedActivity();
      await createReport(activity.id, (await createStudent()).user.id);
      const user = await create();

      const response = await request(app)
        .get("/reports?page=abc")
        .set(...authCookie(user.token));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        status: 403,
        code: "FORBIDDEN",
        message: "User is not a manager.",
      });
    },
  );

  it("returns 403 when the token claims a manager role the database revoked", async () => {
    const manager = await createManager();
    await prisma.user.update({
      where: { id: manager.user.id },
      data: { isManager: false },
    });

    const response = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(403);
  });
});
