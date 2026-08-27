import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";

// REGRESSÃO: o login não é tocado pela refatoração — estes testes passam hoje
// e devem seguir verdes. Pin do contrato: 200 + Set-Cookie httpOnly + corpo
// no envelope { token, user } (diferente do register, agora "achatado").

const LOGIN_URL = "/auth/login";
const probeUrl = () => `/activities/${randomUUID()}/enroll`;

describe("POST /auth/login", () => {
  it("authenticates and returns the { token, user } envelope with a session cookie", async () => {
    const email = "aluno-login@ufal.br";
    const { user } = await createStudent({ email });

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: expect.any(String),
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

  it("accepts the session cookie on protected routes (cookie path)", async () => {
    // A suíte inteira usa Bearer; este é o único teste exercitando o caminho
    // do cookie (cookie-parser → AuthMiddleware).
    const email = "aluno-cookie@ufal.br";
    await createStudent({ email });
    const agent = request.agent(app);
    await agent
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD })
      .expect(200);

    const probe = await agent.post(probeUrl());

    expect(probe.status).toBe(404); // cookie aceito (não 401)
  });

  it("returns 401 for an unknown email", async () => {
    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email: "ninguem@ufal.br", password: DEFAULT_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
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
      message: "Invalid credentials.",
    });
  });
});