import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import {
  createActivity,
  createStudent,
  createTeacher,
  DEFAULT_PASSWORD,
} from "../../helpers/factories.js";

const protectedRoutes = [
  { method: "get", path: "/users/me", body: undefined },
  { method: "post", path: "/activities/:id/enroll", body: undefined },
  {
    method: "patch",
    path: "/activities/:id",
    body: { title: "Updated action" },
  },
  {
    method: "post",
    path: "/activities/:id/reports",
    body: { category: "SPAM" },
  },
  { method: "post", path: "/activities", body: {} },
  { method: "delete", path: "/activities/:id", body: undefined },
  {
    method: "patch",
    path: "/activities/:id/status",
    body: { status: "IN_PROGRESS" },
  },
] as const;

describe.each(["removed", "revoked"] as const)("%s session", (reason) => {
  it.each(protectedRoutes)(
    "returns SESSION_INVALID on $method $path",
    async ({ method, path, body }) => {
      const owner = await createTeacher();
      const activity = await createActivity(owner.user.id);
      const { user } = await createStudent();
      const agent = request.agent(app);
      await agent
        .post("/auth/login")
        .send({ email: user.email, password: DEFAULT_PASSWORD })
        .expect(200);

      if (reason === "removed") {
        await prisma.user.delete({ where: { id: user.id } });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { tokenVersion: { increment: 1 } },
        });
      }

      const pending = agent[method](path.replace(":id", activity.id));
      const response = await (body === undefined
        ? pending
        : pending.send(body));

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 401,
        code: "SESSION_INVALID",
        message: "Session is no longer valid.",
      });
    },
  );
});

describe("current session roles", () => {
  it("applies a manager promotion and demotion without another login", async () => {
    const owner = await createTeacher();
    const activity = await createActivity(owner.user.id);
    const { user } = await createTeacher();
    const agent = request.agent(app);
    await agent
      .post("/auth/login")
      .send({ email: user.email, password: DEFAULT_PASSWORD })
      .expect(200);

    await agent.get("/reports").expect(403);
    await agent
      .patch(`/activities/${activity.id}`)
      .send({ title: "Unauthorized edit" })
      .expect(403);

    await prisma.user.update({
      where: { id: user.id },
      data: { isManager: true },
    });

    await agent.get("/reports").expect(200);
    await agent
      .patch(`/activities/${activity.id}`)
      .send({ title: "Manager edit" })
      .expect(200);

    await prisma.user.update({
      where: { id: user.id },
      data: { isManager: false },
    });

    await agent.get("/reports").expect(403);
    await agent
      .patch(`/activities/${activity.id}`)
      .send({ title: "Unauthorized edit" })
      .expect(403);
    const unchanged = await agent.get(`/activities/${activity.id}`);
    expect(unchanged.body.title).toBe("Manager edit");
  });
});

describe("public routes", () => {
  it("does not look up the session user on the public activity listing", async () => {
    const lookup = vi.spyOn(UserRepository.prototype, "findSessionById");
    try {
      await request(app)
        .get("/activities")
        .set("Cookie", "token=invalid-token")
        .expect(200);
      expect(lookup).not.toHaveBeenCalled();
    } finally {
      lookup.mockRestore();
    }
  });
});
