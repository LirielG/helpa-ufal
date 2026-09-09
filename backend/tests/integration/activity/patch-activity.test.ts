import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createActivity, createTeacher } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";

describe("PATCH /activities/:id", () => {
  it("rejects a valid token whose user no longer exists in the database (ghost user)", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10 });

    await prisma.user.delete({ where: { id: author.user.id } });

    const response = await request(app)
      .patch(`/activities/${activity.id}`)
      .set(...authHeader(author.token))
      .send({ title: "Título Atualizado de Usuário Fantasma" });
      
    expect(response.status).toBe(403);
  });
});