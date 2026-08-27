import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";

const LOGOUT_URL = "/auth/logout";
const LOGIN_URL = "/auth/login";
const probeUrl = () => `/activities/${randomUUID()}/enroll`;

describe("POST /auth/logout", () => {
  it("returns 204 and clears the session cookie", async () => {
    const email = "aluno-logout@ufal.br";
    await createStudent({ email });
    const agent = request.agent(app);
    await agent
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD })
      .expect(200);

    const response = await agent.post(LOGOUT_URL);

    expect(response.status).toBe(204);
    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const [cleared] = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(cleared).toMatch(/^token=;/); // valor esvaziado
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/); // expirado no passado

    // O jar do agente descartou o cookie: a sonda volta desautenticada.
    const probe = await agent.post(probeUrl());
    expect(probe.status).toBe(401);
  });

  it("is public and idempotent: 204 even without a session", async () => {
    // AuthRouter não aplica middleware ao logout — caracterização do comportamento.
    const response = await request(app).post(LOGOUT_URL);

    expect(response.status).toBe(204);
  });
});