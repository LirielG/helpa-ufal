import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createStudent, createActivity, createEnrollment } from "../../helpers/factories.js";

/**
 * Escopo deste arquivo: itens do checklist da issue #126 para GET
 * /activities que NÃO são o filtro `area` (esse já está integralmente
 * coberto por list-activities.test.ts — não duplicado aqui).
 *
 * Limites e mensagens confirmados em ActivityService.list: `limit` máximo
 * real é 100 (não 50, como o contrato Bruno documentava antes da correção
 * registrada em List-activities.yml); `page`/`limit` inválidos usam
 * "page must be a positive integer." / "limit can not exceed 100.".
 */

describe("GET /activities", () => {
  it("is public: answers without any token", async () => {
    const author = await createTeacher();
    await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("activities");
    expect(response.body).toHaveProperty("total");
  });

  it("paginates: limit=2 returns 2 items and total reflects the whole matching set", async () => {
    const author = await createTeacher();
    for (let i = 0; i < 5; i++) {
      await createActivity(author.user.id, { status: "OPEN" });
    }

    const response = await request(app).get("/activities").query({ limit: 2, page: 1 });

    expect(response.status).toBe(200);
    expect(response.body.activities).toHaveLength(2);
    expect(response.body.total).toBe(5);
  });

  it("returns 400 when limit exceeds the real maximum of 100", async () => {
    const response = await request(app).get("/activities").query({ limit: 101 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      { field: "limit", message: "limit can not exceed 100." },
    ]);
  });

  it("returns 400 when page is 0", async () => {
    const response = await request(app).get("/activities").query({ page: 0 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
  });

  it("filters by type", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { type: "COURSE" });
    await createActivity(author.user.id, { type: "EVENT" });

    const response = await request(app).get("/activities").query({ type: "COURSE" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by format", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { format: "ONLINE" });
    await createActivity(author.user.id, { format: "IN_PERSON" });

    const response = await request(app).get("/activities").query({ format: "ONLINE" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by status", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { status: "OPEN" });
    await createActivity(author.user.id, { status: "IN_PROGRESS" });

    const response = await request(app).get("/activities").query({ status: "OPEN" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by campus", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { campus: "ARAPIRACA" });
    await createActivity(author.user.id, { campus: "MACEIO" });

    const response = await request(app).get("/activities").query({ campus: "ARAPIRACA" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("computes availableSlots from APPROVED enrollments only", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10, status: "OPEN" });

    const student1 = await createStudent();
    const student2 = await createStudent();
    const student3 = await createStudent();

    await createEnrollment(student1.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student2.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student3.user.id, activity.id, { status: "REJECTED" });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body.activities[0].availableSlots).toBe(8);
  });

  it("does not list a soft-deleted activity", async () => {
    const author = await createTeacher();
    const deleted = await createActivity(author.user.id, {
      status: "OPEN",
      deletedAt: new Date(),
    });
    const visible = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app).get("/activities");

    const ids = response.body.activities.map((a: { id: string }) => a.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(deleted.id);
  });
});
