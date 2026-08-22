import { describe, it, expect } from "vitest"; // globals não está ativo: import explícito
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createStudent, createTeacher, createManager, createActivity } from "../../helpers/factories.js";
import { authHeader, authCookie, invalidToken } from "../../helpers/auth.js";

describe("DELETE /activities/:id", () => {
  it("retorna 204, preenche deletedAt e mantém a linha no banco", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    // Consulta direta ao banco (bypassa a API): prova o "soft" do soft delete.
    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });

  it("torna a atividade invisível para as rotas de leitura (2.5.1)", async () => {
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

  it("retorna 404 na segunda exclusão e preserva o deletedAt original", async () => {
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

  it("retorna 403 quando o solicitante não é autor nem gestor", async () => {
    const author = await createTeacher();
    const other = await createStudent();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(other.token))
      .expect(403);

    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row!.deletedAt).toBeNull(); // nada foi tocado
  });

  it("retorna 204 quando um gestor deleta atividade de outro autor", async () => {
    const author = await createTeacher();
    const manager = await createManager();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(manager.token))
      .expect(204);
  });

  it("retorna 401 sem token e com token inválido", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app).delete(`/activities/${activity.id}`).expect(401);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(invalidToken()))
      .expect(401);
  });

  it("retorna 400 para id que não é UUID", async () => {
    const author = await createTeacher();

    await request(app)
      .delete("/activities/not-a-uuid")
      .set(...authHeader(author.token))
      .expect(400);
  });

  it("retorna 404 para UUID válido de atividade inexistente", async () => {
    const author = await createTeacher();

    await request(app)
      .delete(`/activities/${randomUUID()}`)
      .set(...authHeader(author.token))
      .expect(404);
  });

  it("preserva inscrições vinculadas após o soft delete (histórico intacto)", async () => {
    // US 2.5: deletar não pode destruir históricode inscrições/presenças/certificados.
    const author = await createTeacher();
    const student = await createStudent();
    const activity = await createActivity(author.user.id);

    // Como não há criação de Enrollments, cria direto via Prisma
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

  it("preserva denúncias vinculadas após o soft delete", async () => {
    // ActivityReport tem onDelete: Cascade — só dispararia em delete FÍSICO.
    // Este teste é o guardião: se alguém trocar softDelete por delete físico,
    // o report some e o teste quebra.
    const author = await createTeacher();
    const reporter = await createStudent();
    const activity = await createActivity(author.user.id);

    const report = await prisma.activityReport.create({
      data: {
        activityId: activity.id,
        userId: reporter.user.id,
        category: "SPAM",
        description: "Report de teste.",
      },
    });

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const preserved = await prisma.activityReport.findUnique({ where: { id: report.id } });
    expect(preserved).not.toBeNull();
  });

  it("aceita autenticação via cookie (mesmo resultado que Bearer)", async () => {
    // O middleware aceita cookie OU header [15]. Se um dia o suporte a
    // cookie quebrar, o frontend (que usa cookie com credentials) perde o delete.
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authCookie(author.token))
      .expect(204);
  });

  it("o autor estudante também consegue deletar a própria atividade", async () => {
    // A US 2.5 diz "criador da ação" — aluno OU docente. O teste de gestor
    // usa TEACHER; este garante que STUDENT autor não é bloqueado por engano.
    const author = await createStudent();
    const activity = await createActivity(author.user.id);

    await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);
  });

  it("não afeta outras atividades do mesmo autor", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { title: "Vai ser deletada" });
    const survivor = await createActivity(author.user.id, { title: "Deve sobreviver" });

    await request(app)
      .delete(`/activities/${target.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    const list = await request(app).get("/activities").expect(200);
    const ids = list.body.activities.map((a: { id: string }) => a.id);
    expect(ids).toContain(survivor.id);
    expect(ids).not.toContain(target.id);
  });

  it("204 retorna corpo vazio, conforme o contrato", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id);

    const response = await request(app)
      .delete(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .expect(204);

    expect(response.text).toBe(""); // Bruno: 204 sem body [26]
  });
});