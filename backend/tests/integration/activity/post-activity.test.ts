import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createTeacher } from "../../helpers/factories.js";
import { authHeader } from "../../helpers/auth.js";
import { daysFromNow } from "../../helpers/dates.js";

const validPayload = {
  title: "Oficina de Teste",
  type: "EXTENSION",
  campus: "MACEIO",
  startDate: daysFromNow(10).toISOString(),
  endDate: daysFromNow(12).toISOString(),
  slots: 30,
  description: "Descrição de teste para atividade",
  area: "Tecnologia",
  workloadHours: 20,
  format: "ONLINE",
  url: "https://meet.google.com/abc-defg-hij",
};

describe("POST /activities", () => {
  it("rejects a valid token whose user no longer exists in the database (ghost user)", async () => {
    // 1. Create active user & obtain cryptographically valid token
    const teacher = await createTeacher();

    // 2. Delete user from DB while token is still valid (ghost user)
    await prisma.teacher.deleteMany({ where: { userId: teacher.user.id } });
    await prisma.user.delete({ where: { id: teacher.user.id } });

    // 3. Attempt to create activity with the ghost user's token
    const response = await request(app)
      .post("/activities")
      .set(...authHeader(teacher.token))
      .send(validPayload);

    // 4. Assert 403 Forbidden with exact permission message
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      message: "You do not have permission to create an activity.",
    });

    // 5. Verify no orphaned activity was persisted in the database
    const count = await prisma.activity.count({
      where: { authorId: teacher.user.id },
    });
    expect(count).toBe(0);
  });
});
