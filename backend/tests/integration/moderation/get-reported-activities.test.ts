import { describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createManager,
  createModerationDecision,
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

describe("GET /reported-activities", () => {
  // ---------- 200 ----------

  it("returns open reported activities with exact DTO fields and no sensitive user data", async () => {
    const manager = await createManager({ fullName: "Gestor UFAL" });
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      title: "Oficina de Introdução à Programação",
      status: "OPEN",
    });
    const reporter = await createStudent({ fullName: "Maria Clara Santos" });
    const report = await createReport(activity.id, reporter.user.id, {
      category: "MISINFORMATION",
      description: "O endereço informado está errado.",
    });

    const response = await request(app)
      .get("/reported-activities")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          activity: {
            id: activity.id,
            title: "Oficina de Introdução à Programação",
            status: "OPEN",
            authorId: author.user.id,
            removedByModerationAt: null,
          },
          openReports: [
            {
              id: report.id,
              category: "MISINFORMATION",
              description: "O endereço informado está errado.",
              createdAt: report.createdAt.toISOString(),
              reporter: {
                id: reporter.user.id,
                fullName: "Maria Clara Santos",
              },
            },
          ],
          decisions: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain(reporter.user.email);
    expect(JSON.stringify(response.body)).not.toContain(manager.user.email);
  });

  it("returns 200 with an empty page when nothing was reported", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get("/reported-activities")
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

  it("separates open and decided queues; an activity with an open report and past decisions appears only in open", async () => {
    const manager = await createManager({ fullName: "Gestor Principal" });
    const author = await createTeacher();

    const openOnly = await createActivity(author.user.id, {
      title: "Open only",
    });
    await createReport(openOnly.id, (await createStudent()).user.id, {
      createdAt: daysFromNow(-2),
    });

    const reopened = await createActivity(author.user.id, {
      title: "Reopened",
    });
    const oldDecision = await createModerationDecision(
      reopened.id,
      manager.user.id,
      {
        verdict: "REJECTED",
        justification: "Primeira análise improcedente.",
        createdAt: daysFromNow(-4),
      },
    );
    const oldReport = await createReport(
      reopened.id,
      (await createStudent()).user.id,
      { decisionId: oldDecision.id, createdAt: daysFromNow(-5) },
    );
    const newReport = await createReport(
      reopened.id,
      (await createStudent()).user.id,
      { createdAt: daysFromNow(-1) },
    );

    const decidedOnly = await createActivity(author.user.id, {
      title: "Decided only",
    });
    const decision = await createModerationDecision(
      decidedOnly.id,
      manager.user.id,
      {
        verdict: "REJECTED",
        justification: "Tudo certo.",
        createdAt: daysFromNow(-3),
      },
    );
    await createReport(decidedOnly.id, (await createStudent()).user.id, {
      decisionId: decision.id,
      createdAt: daysFromNow(-4),
    });

    const openRes = await request(app)
      .get("/reported-activities?status=open")
      .set(...authCookie(manager.token));
    expect(openRes.status).toBe(200);
    expect(openRes.body.total).toBe(2);
    expect(
      openRes.body.items.map(
        (item: { activity: { id: string } }) => item.activity.id,
      ),
    ).toEqual([reopened.id, openOnly.id]);
    expect(
      openRes.body.items[0].openReports.map((r: { id: string }) => r.id),
    ).toEqual([newReport.id]);
    expect(openRes.body.items[0].decisions).toHaveLength(1);
    expect(
      openRes.body.items[0].decisions[0].reports.map(
        (r: { id: string }) => r.id,
      ),
    ).toEqual([oldReport.id]);

    const decidedRes = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(manager.token));
    expect(decidedRes.status).toBe(200);
    expect(decidedRes.body.total).toBe(1);
    expect(
      decidedRes.body.items.map(
        (item: { activity: { id: string } }) => item.activity.id,
      ),
    ).toEqual([decidedOnly.id]);
    expect(decidedRes.body.items[0].openReports).toEqual([]);
  });

  it("orders open by most recent open report and decided by most recent decision, with decisions newest first", async () => {
    const manager = await createManager();
    const author = await createTeacher();

    const actOlderOpen = await createActivity(author.user.id, {
      title: "Older open",
    });
    await createReport(actOlderOpen.id, (await createStudent()).user.id, {
      createdAt: daysFromNow(-3),
    });

    const actNewerOpen = await createActivity(author.user.id, {
      title: "Newer open",
    });
    await createReport(actNewerOpen.id, (await createStudent()).user.id, {
      createdAt: daysFromNow(-5),
    });
    await createReport(actNewerOpen.id, (await createStudent()).user.id, {
      createdAt: daysFromNow(-1),
    });

    const openRes = await request(app)
      .get("/reported-activities?status=open&page=1&limit=1")
      .set(...authCookie(manager.token));
    expect(openRes.status).toBe(200);
    expect(openRes.body).toMatchObject({
      total: 2,
      page: 1,
      limit: 1,
      totalPages: 2,
    });
    expect(openRes.body.items[0].activity.id).toBe(actNewerOpen.id);

    const openPage2 = await request(app)
      .get("/reported-activities?status=open&page=2&limit=1")
      .set(...authCookie(manager.token));
    expect(openPage2.body.items[0].activity.id).toBe(actOlderOpen.id);

    const decOld = await createActivity(author.user.id, { title: "Dec old" });
    await createModerationDecision(decOld.id, manager.user.id, {
      createdAt: daysFromNow(-4),
    });

    const decMulti = await createActivity(author.user.id, {
      title: "Dec multi",
    });
    const firstDec = await createModerationDecision(
      decMulti.id,
      manager.user.id,
      { createdAt: daysFromNow(-6), justification: "Primeira" },
    );
    const secondDec = await createModerationDecision(
      decMulti.id,
      manager.user.id,
      { createdAt: daysFromNow(-2), justification: "Segunda" },
    );

    const decidedRes = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(manager.token));
    expect(decidedRes.status).toBe(200);
    expect(
      decidedRes.body.items.map(
        (item: { activity: { id: string } }) => item.activity.id,
      ),
    ).toEqual([decMulti.id, decOld.id]);
    expect(
      decidedRes.body.items[0].decisions.map((d: { id: string }) => d.id),
    ).toEqual([secondDec.id, firstDec.id]);
  });

  it("returns null for reporter and decidedBy when their user accounts were removed", async () => {
    const viewer = await createManager();
    const removedManager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);
    const removedReporter = await createStudent();

    const decision = await createModerationDecision(
      activity.id,
      removedManager.user.id,
    );
    await createReport(activity.id, removedReporter.user.id, {
      decisionId: decision.id,
    });

    await removeUser(removedReporter.user.id);
    await removeUser(removedManager.user.id);

    const response = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(viewer.token));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].decisions[0].decidedBy).toBeNull();
    expect(response.body.items[0].decisions[0].reports[0].reporter).toBeNull();
  });

  it("omits author soft-deleted activities from open but preserves their history in decided", async () => {
    const manager = await createManager();
    const author = await createTeacher();

    const deletedOpen = await createActivity(author.user.id, {
      deletedAt: new Date(),
    });
    await createReport(deletedOpen.id, (await createStudent()).user.id);

    const deletedDecided = await createActivity(author.user.id, {
      deletedAt: new Date(),
    });
    const decision = await createModerationDecision(
      deletedDecided.id,
      manager.user.id,
    );
    await createReport(deletedDecided.id, (await createStudent()).user.id, {
      decisionId: decision.id,
    });

    const openRes = await request(app)
      .get("/reported-activities?status=open")
      .set(...authCookie(manager.token));
    expect(openRes.status).toBe(200);
    expect(openRes.body.items).toEqual([]);
    expect(openRes.body.total).toBe(0);

    const decidedRes = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(manager.token));
    expect(decidedRes.status).toBe(200);
    expect(decidedRes.body.total).toBe(1);
    expect(decidedRes.body.items[0].activity.id).toBe(deletedDecided.id);
  });

  it("returns an empty page beyond the last one while keeping total and totalPages", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);
    await createReport(activity.id, (await createStudent()).user.id);

    const response = await request(app)
      .get("/reported-activities?page=5")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total: 1,
      page: 5,
      limit: 20,
      totalPages: 1,
    });
  });

  it("returns an empty page for page=MAX_SAFE_INTEGER, and 400 when page exceeds safe integer range", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);
    await createReport(activity.id, (await createStudent()).user.id);

    const huge = await request(app)
      .get(`/reported-activities?page=${Number.MAX_SAFE_INTEGER}`)
      .set(...authCookie(manager.token));
    expect(huge.status).toBe(200);
    expect(huge.body).toMatchObject({
      items: [],
      total: 1,
      page: Number.MAX_SAFE_INTEGER,
      totalPages: 1,
    });

    for (const unsafePage of [
      String(Number.MAX_SAFE_INTEGER + 1),
      `1${"0".repeat(310)}`,
    ]) {
      const overflow = await request(app)
        .get(`/reported-activities?page=${unsafePage}`)
        .set(...authCookie(manager.token));
      expect(overflow.status).toBe(400);
      expect(overflow.body.errors).toEqual([
        {
          field: "page",
          code: "VALIDATION_ERROR",
          message: "page must be a positive integer.",
        },
      ]);
    }
  });

  it("breaks exact createdAt ties deterministically by activity id ascending", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const tiedAt = new Date("2026-06-05T12:00:00.000Z");

    const actA = await createActivity(author.user.id, { title: "Tie A" });
    const actB = await createActivity(author.user.id, { title: "Tie B" });
    await createReport(actA.id, (await createStudent()).user.id, {
      createdAt: tiedAt,
    });
    await createReport(actB.id, (await createStudent()).user.id, {
      createdAt: tiedAt,
    });

    const response = await request(app)
      .get("/reported-activities?status=open")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(200);
    expect(
      response.body.items.map(
        (item: { activity: { id: string } }) => item.activity.id,
      ),
    ).toEqual([actA.id, actB.id].sort());
  });

  // ---------- 400 ----------

  it.each([
    ["status=", "status", "status must be one of: open, decided."],
    ["status=OPEN", "status", "status must be one of: open, decided."],
    ["page=0", "page", "page must be a positive integer."],
    ["limit=101", "limit", "limit must be at most 100."],
  ])("returns 400 for ?%s", async (query, field, message) => {
    const manager = await createManager();

    const response = await request(app)
      .get(`/reported-activities?${query}`)
      .set(...authCookie(manager.token));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid query parameters.",
      errors: [{ field, code: "VALIDATION_ERROR", message }],
    });
  });

  it("returns 400 UNKNOWN_PARAMETER for unsupported parameters", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get("/reported-activities?resolved=false")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      {
        field: "resolved",
        code: "UNKNOWN_PARAMETER",
        message: "resolved is not a supported query parameter.",
      },
    ]);
  });

  // ---------- 401 / 403 ----------

  it("returns 401 without a token, even with a malformed query", async () => {
    const response = await request(app).get("/reported-activities?page=abc");

    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid or expired token", async () => {
    const manager = await createManager();
    const expired = signToken(
      { id: manager.user.id, userType: "TEACHER", isManager: true },
      "-1s",
    );

    const invalidRes = await request(app)
      .get("/reported-activities")
      .set(...authCookie(invalidToken()));
    expect(invalidRes.status).toBe(401);

    const expiredRes = await request(app)
      .get("/reported-activities")
      .set(...authCookie(expired));
    expect(expiredRes.status).toBe(401);
  });

  it("returns 401 SESSION_INVALID for a removed manager", async () => {
    const manager = await createManager();
    await removeUser(manager.user.id);

    const response = await request(app)
      .get("/reported-activities")
      .set(...authCookie(manager.token));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "SESSION_INVALID",
      message: "Session is no longer valid.",
    });
  });

  it.each([
    ["student", createStudent],
    ["teacher", createTeacher],
  ])(
    "returns 403 to a non-manager %s before validating query",
    async (_, create) => {
      const user = await create();

      const response = await request(app)
        .get("/reported-activities?page=abc")
        .set(...authCookie(user.token));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        status: 403,
        code: "FORBIDDEN",
        message: "User is not a manager.",
      });
    },
  );

  // ---------- Legacy routes removed ----------

  it("no longer serves legacy GET /reports and PUT /reports/:reportId/resolution", async () => {
    const manager = await createManager();

    const getRes = await request(app)
      .get("/reports")
      .set(...authCookie(manager.token));
    expect(getRes.status).toBe(404);

    const putRes = await request(app)
      .put(`/reports/${randomUUID()}/resolution`)
      .set(...authCookie(manager.token));
    expect(putRes.status).toBe(404);
  });
});
