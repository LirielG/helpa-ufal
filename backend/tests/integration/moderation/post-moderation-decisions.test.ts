import { describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import ModerationRepository from "@/repositories/moderation/ModerationRepository.js";
import { expectHttpError } from "@/utils/tests.js";
import {
  createActivity,
  createCertificate,
  createEnrollment,
  createManager,
  createReport,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken } from "../../helpers/auth.js";

function decide(
  activityId: string,
  body: Record<string, unknown>,
  token?: string,
) {
  const req = request(app)
    .post(`/activities/${activityId}/moderation-decisions`)
    .send(body);
  return token ? req.set(...authCookie(token)) : req;
}

describe("POST /activities/:activityId/moderation-decisions", () => {
  // ---------- 201 REJECTED & queue transitions ----------

  it("links all open reports on REJECTED, moves activity from open to decided, and reopens on a new report", async () => {
    const manager = await createManager({ fullName: "Gestora UFAL" });
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const r1 = await createStudent({ fullName: "Aluno Um" });
    const r2 = await createStudent({ fullName: "Aluno Dois" });
    const r3 = await createStudent({ fullName: "Aluno Tres" });
    const report1 = await createReport(activity.id, r1.user.id);
    const report2 = await createReport(activity.id, r2.user.id);
    const report3 = await createReport(activity.id, r3.user.id);

    const response = await decide(
      activity.id,
      {
        verdict: "REJECTED",
        justification: "  Conteúdo verificado e regular.  ",
      },
      manager.token,
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      verdict: "REJECTED",
      justification: "Conteúdo verificado e regular.",
      createdAt: expect.stringMatching(/Z$/),
      decidedBy: { id: manager.user.id, fullName: "Gestora UFAL" },
    });
    expect(
      response.body.reports.map((r: { id: string }) => r.id).sort(),
    ).toEqual([report1.id, report2.id, report3.id].sort());

    const storedActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });
    expect(storedActivity.removedByModerationAt).toBeNull();
    expect(storedActivity.status).toBe("OPEN");

    const openQueue = await request(app)
      .get("/reported-activities?status=open")
      .set(...authCookie(manager.token));
    expect(openQueue.body.items).toEqual([]);

    const decidedQueue = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(manager.token));
    expect(decidedQueue.body.items).toHaveLength(1);
    expect(decidedQueue.body.items[0].activity.id).toBe(activity.id);
    expect(decidedQueue.body.items[0].decisions).toHaveLength(1);
    expect(decidedQueue.body.items[0].decisions[0].reports).toHaveLength(3);

    // Same reporter still gets 409 on duplicate report.
    const dupReport = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(r1.token))
      .send({ category: "SPAM" });
    expect(dupReport.status).toBe(409);

    // Another user reporting returns the activity to open, preserving past decision.
    const r4 = await createStudent({ fullName: "Aluno Quatro" });
    const newReport = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(r4.token))
      .send({
        category: "INAPPROPRIATE_CONTENT",
        description: "Novo problema.",
      });
    expect(newReport.status).toBe(201);

    const reopenedQueue = await request(app)
      .get("/reported-activities?status=open")
      .set(...authCookie(manager.token));
    expect(reopenedQueue.body.items).toHaveLength(1);
    expect(
      reopenedQueue.body.items[0].openReports.map((r: { id: string }) => r.id),
    ).toEqual([newReport.body.id]);
    expect(reopenedQueue.body.items[0].decisions).toHaveLength(1);
    expect(reopenedQueue.body.items[0].decisions[0].id).toBe(response.body.id);

    const decidedAfterReopen = await request(app)
      .get("/reported-activities?status=decided")
      .set(...authCookie(manager.token));
    expect(decidedAfterReopen.body.items).toEqual([]);
  });

  // ---------- 201 UPHELD side effects ----------

  it("sets removedByModerationAt, cancels PENDING/APPROVED enrollments without certificate, and keeps certified enrollments and certificates intact", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    await createReport(activity.id, (await createStudent()).user.id);

    const pendingStudent = await createStudent();
    const approvedStudent = await createStudent();
    const rejectedStudent = await createStudent();
    const certifiedStudent = await createStudent();

    const pendingEnrollment = await createEnrollment(
      pendingStudent.user.id,
      activity.id,
      { status: "PENDING" },
    );
    const approvedEnrollment = await createEnrollment(
      approvedStudent.user.id,
      activity.id,
      { status: "APPROVED" },
    );
    const rejectedEnrollment = await createEnrollment(
      rejectedStudent.user.id,
      activity.id,
      { status: "REJECTED" },
    );
    const certifiedEnrollment = await createEnrollment(
      certifiedStudent.user.id,
      activity.id,
      {
        status: "APPROVED",
        attendanceConfirmed: true,
        confirmedWorkloadHours: 20,
      },
    );
    const certificate = await createCertificate(certifiedEnrollment.id);

    const response = await decide(
      activity.id,
      {
        verdict: "UPHELD",
        justification: "Ação viola diretrizes da instituição.",
      },
      manager.token,
    );

    expect(response.status).toBe(201);
    expect(response.body.verdict).toBe("UPHELD");

    const storedActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });
    expect(storedActivity.removedByModerationAt?.toISOString()).toBe(
      response.body.createdAt,
    );
    expect(storedActivity.status).toBe("OPEN");

    const [p, a, r, c] = await Promise.all([
      prisma.enrollment.findUniqueOrThrow({
        where: { id: pendingEnrollment.id },
      }),
      prisma.enrollment.findUniqueOrThrow({
        where: { id: approvedEnrollment.id },
      }),
      prisma.enrollment.findUniqueOrThrow({
        where: { id: rejectedEnrollment.id },
      }),
      prisma.enrollment.findUniqueOrThrow({
        where: { id: certifiedEnrollment.id },
      }),
    ]);
    expect(p.status).toBe("CANCELLED");
    expect(a.status).toBe("CANCELLED");
    expect(r.status).toBe("REJECTED");
    expect(c.status).toBe("APPROVED");

    // Certificate stays valid on public validator and downloadable by holder.
    const validateRes = await request(app).get(
      `/certificate-validations/${certificate.validationCode}`,
    );
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.validationCode).toBe(certificate.validationCode);

    const downloadRes = await request(app)
      .get(`/certificates/${certificate.id}/file`)
      .set(...authCookie(certifiedStudent.token));
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toContain("application/pdf");
  });

  it.each(["IN_PROGRESS", "CANCELLED"] as const)(
    "allows UPHELD on an activity with status %s",
    async (status) => {
      const manager = await createManager();
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status });
      await createReport(activity.id, (await createStudent()).user.id);

      const response = await decide(
        activity.id,
        { verdict: "UPHELD", justification: "Remoção procedente." },
        manager.token,
      );

      expect(response.status).toBe(201);
      const stored = await prisma.activity.findUniqueOrThrow({
        where: { id: activity.id },
      });
      expect(stored.removedByModerationAt).not.toBeNull();
      expect(stored.status).toBe(status);
    },
  );

  // ---------- COMPLETED rules ----------

  it("returns 409 ACTIVITY_COMPLETED for UPHELD on a COMPLETED activity, while accepting REJECTED", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "COMPLETED",
    });
    await createReport(activity.id, (await createStudent()).user.id);

    const upheldRes = await decide(
      activity.id,
      { verdict: "UPHELD", justification: "Tentativa de remoção." },
      manager.token,
    );
    expect(upheldRes.status).toBe(409);
    expect(upheldRes.body).toEqual({
      status: 409,
      code: "ACTIVITY_COMPLETED",
      message: "Completed activities cannot be removed by moderation.",
    });

    const rejectedRes = await decide(
      activity.id,
      { verdict: "REJECTED", justification: "Denúncia improcedente." },
      manager.token,
    );
    expect(rejectedRes.status).toBe(201);
    expect(rejectedRes.body.verdict).toBe("REJECTED");
  });

  it("still allows completing an activity that has open reports via PUT /activities/:id/status", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "IN_PROGRESS",
    });
    await createReport(activity.id, (await createStudent()).user.id);

    const statusRes = await request(app)
      .put(`/activities/${activity.id}/status`)
      .set(...authCookie(author.token))
      .send({ status: "COMPLETED" });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("COMPLETED");
  });

  // ---------- Concurrency & 409 NO_OPEN_REPORTS ----------

  it("returns 409 NO_OPEN_REPORTS when the activity has no open reports (including COMPLETED)", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "COMPLETED",
    });

    const response = await decide(
      activity.id,
      { verdict: "UPHELD", justification: "Sem denúncias." },
      manager.token,
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      code: "NO_OPEN_REPORTS",
      message: "Activity has no open reports.",
    });
  });

  it("serializes concurrent decisions so double-click creates exactly one decision and answers 409 NO_OPEN_REPORTS to the second", async () => {
    const manager1 = await createManager();
    const manager2 = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    await createReport(activity.id, (await createStudent()).user.id);

    const [res1, res2] = await Promise.all([
      decide(
        activity.id,
        { verdict: "REJECTED", justification: "Decisão 1." },
        manager1.token,
      ),
      decide(
        activity.id,
        { verdict: "UPHELD", justification: "Decisão 2." },
        manager2.token,
      ),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.code).toBe("NO_OPEN_REPORTS");

    const decisions = await prisma.moderationDecision.findMany({
      where: { activityId: activity.id },
      include: { reports: true },
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.reports).toHaveLength(1);
  });

  // ---------- 400 / 401 / 403 / 404 & validation order ----------

  it.each(["", "   ", "a".repeat(501)])(
    "returns 400 with field justification for invalid justification (%j)",
    async (justification) => {
      const manager = await createManager();
      const author = await createTeacher();
      const activity = await createActivity(author.user.id);

      const response = await decide(
        activity.id,
        { verdict: "REJECTED", justification },
        manager.token,
      );

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: "justification",
          code: "VALIDATION_ERROR",
        }),
      );
    },
  );

  it("combines invalid activityId and invalid body into one errors[]", async () => {
    const manager = await createManager();

    const response = await decide(
      "not-a-uuid",
      { verdict: "INVALID", justification: "" },
      manager.token,
    );

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: "activityId",
          code: "INVALID_UUID",
          message: "activityId must be a valid UUID.",
        },
        expect.objectContaining({ field: "verdict", code: "VALIDATION_ERROR" }),
        expect.objectContaining({
          field: "justification",
          code: "VALIDATION_ERROR",
        }),
      ]),
    );
  });

  it("returns 404 ACTIVITY_NOT_FOUND for a non-existent or soft-deleted activity", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const deleted = await createActivity(author.user.id, {
      deletedAt: new Date(),
    });
    await createReport(deleted.id, (await createStudent()).user.id);

    for (const id of [randomUUID(), deleted.id]) {
      const response = await decide(
        id,
        { verdict: "REJECTED", justification: "Não existe." },
        manager.token,
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 404,
        code: "ACTIVITY_NOT_FOUND",
        message: "Activity not found.",
      });
    }
  });

  it("returns 403 FORBIDDEN when the manager is the author of the activity", async () => {
    const managerAuthor = await createManager();
    const activity = await createActivity(managerAuthor.user.id);
    await createReport(activity.id, (await createStudent()).user.id);

    const response = await decide(
      activity.id,
      { verdict: "REJECTED", justification: "Minha própria ação." },
      managerAuthor.token,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "Activity authors cannot moderate their own activity.",
    });
  });

  it("checks 401 and 403 manager role before format and existence", async () => {
    const student = await createStudent();

    const unauth = await decide("not-a-uuid", { verdict: "BAD" });
    expect(unauth.status).toBe(401);

    const badToken = await decide(
      "not-a-uuid",
      { verdict: "BAD" },
      invalidToken(),
    );
    expect(badToken.status).toBe(401);

    const nonManager = await decide(
      "not-a-uuid",
      { verdict: "BAD" },
      student.token,
    );
    expect(nonManager.status).toBe(403);
    expect(nonManager.body.code).toBe("FORBIDDEN");
  });

  it("rejects empty body and unknown body keys with 400", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    const empty = await decide(activity.id, {}, manager.token);
    expect(empty.status).toBe(400);
    expect(empty.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "verdict" }),
        expect.objectContaining({ field: "justification" }),
      ]),
    );

    const extra = await decide(
      activity.id,
      {
        verdict: "REJECTED",
        justification: "Justificativa válida.",
        unexpectedField: true,
      },
      manager.token,
    );
    expect(extra.status).toBe(400);
    expect(extra.body.code).toBe("VALIDATION_ERROR");
  });

  it("preserves the original removedByModerationAt timestamp if an already-removed activity receives another UPHELD", async () => {
    const manager = await createManager();
    const author = await createTeacher();
    const originalRemovedAt = new Date("2026-06-01T10:00:00.000Z");
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      removedByModerationAt: originalRemovedAt,
    });
    await createReport(activity.id, (await createStudent()).user.id);

    const response = await decide(
      activity.id,
      { verdict: "UPHELD", justification: "Segunda análise procedente." },
      manager.token,
    );

    expect(response.status).toBe(201);
    const stored = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });
    expect(stored.removedByModerationAt?.toISOString()).toBe(
      originalRemovedAt.toISOString(),
    );
  });

  it("maps a deleted manager FK violation during decision creation to 401 SESSION_INVALID instead of 500", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);
    await createReport(activity.id, (await createStudent()).user.id);

    const repository = new ModerationRepository();
    await expectHttpError(
      repository.createDecision(activity.id, randomUUID(), {
        verdict: "REJECTED",
        justification: "Gestor removido em voo.",
      }),
      401,
      "Session is no longer valid.",
      "SESSION_INVALID",
    );
  });
});
