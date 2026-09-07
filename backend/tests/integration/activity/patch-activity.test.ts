import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createActivity, createTeacher } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

describe("PATCH /activities/:id", () => {
  it("rejects a valid token whose user no longer exists in the database (ghost user)", async () => {
    // 1. Cria um professor/autor e uma atividade vinculada a ele
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });

    // 2. Apaga o usuário diretamente no banco, simulando conta excluída
    await prisma.user.delete({ where: { id: author.user.id } });

    // 3. Tenta editar a atividade usando o token ainda válido da conta excluída
    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ title: "Título Atualizado de Usuário Fantasma" });

    // 4. Garante que a requisição é rejeitada com status 403
    expect(response.status).toBe(403);
  });
});