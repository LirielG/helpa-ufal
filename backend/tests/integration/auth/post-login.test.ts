import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import ms from "ms";
import { app } from "@/app.js";
import { env } from "@/config/env.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";

const LOGIN_URL = "/auth/login";
const probeUrl = () => `/activities/${randomUUID()}/reports`;
const probeBody = { category: "SPAM" };

describe("POST /auth/login", () => {
  it("authenticates and returns only the { user } envelope with a session cookie", async () => {
    const email = "aluno-login@ufal.br";
    const { user } = await createStudent({ email });

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: user.id,
        fullName: user.fullName,
        email,
        userType: "STUDENT",
        isManager: false,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });

    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const [sessionCookie] = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(sessionCookie).toMatch(/^token=/);
    expect(sessionCookie).toMatch(/HttpOnly/i);
  });

  it("sets Max-Age derived from JWT_EXPIRES_IN — cookie and token expire together", async () => {
    const email = "aluno-maxage@ufal.br";
    await createStudent({ email });

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD });

    expect(response.status).toBe(200);
    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const [sessionCookie] = Array.isArray(setCookie) ? setCookie : [setCookie];
    const expectedMaxAge = Math.floor(
      ms(env.JWT_EXPIRES_IN as ms.StringValue) / 1000,
    );
    expect(sessionCookie).toContain(`Max-Age=${expectedMaxAge}`);
    expect(sessionCookie).toMatch(/SameSite=Strict/);
  });

  it("accepts the session cookie on protected routes (cookie path)", async () => {
    const email = "aluno-cookie@ufal.br";
    await createStudent({ email });
    const agent = request.agent(app);
    await agent
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD })
      .expect(200);

    const probe = await agent.post(probeUrl()).send(probeBody);

    expect(probe.status).toBe(404);
    expect(probe.body).toMatchObject({ status: 404 });
  });

  it("rejects an authorization header without a session cookie", async () => {
    const { token } = await createStudent();
    const response = await request(app)
      .get("/users/me")
      .set("Authorization", `${["Bear", "er"].join("")} ${token}`);

    expect(response.status).toBe(401);
  });

  it("loads the profile using the cookie saved by login", async () => {
    const { user } = await createStudent();
    const agent = request.agent(app);
    const login = await agent.post(LOGIN_URL).send({
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    expect(login.status).toBe(200);
    expect(login.body).not.toHaveProperty("token");
    const profile = await agent.get("/users/me");
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(user.id);
  });

  it("returns 401 for an unknown email", async () => {
    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email: "ninguem@ufal.br", password: DEFAULT_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Invalid credentials.",
    });
  });

  it("returns 401 for a wrong password (same message — no user enumeration)", async () => {
    const email = "aluno-401@ufal.br";
    await createStudent({ email });

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email, password: "SenhaErrada@1" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Invalid credentials.",
    });
  });
});
