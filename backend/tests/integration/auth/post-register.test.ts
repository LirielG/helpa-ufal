import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { authHeader } from "../../helpers/auth.js";

// Route contract: docs/Register-a-new-user.yml (Bruno) + swagger.ts.
// Refatoração: o cadastro apenas cria a conta — sem token no corpo e sem
// Set-Cookie. Autenticação acontece exclusivamente em POST /auth/login.

const REGISTER_URL = "/auth/register";
const LOGIN_URL = "/auth/login";
// Sonda de autenticação: sem credenciais → 401; autenticado com atividade
// inexistente → 404 (mesmo padrão de post-enroll.test.ts).
const probeUrl = () => `/activities/${randomUUID()}/enroll`;

function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function aStudentPayload(overrides: Record<string, unknown> = {}) {
  return {
    userType: "STUDENT",
    fullName: "Estudante de Teste",
    email: `${unique("aluno")}@ufal.br`,
    password: "Senha@123",
    course: "Ciência da Computação",
    registrationCode: unique("mat"),
    ...overrides,
  };
}

function aTeacherPayload(overrides: Record<string, unknown> = {}) {
  return {
    userType: "TEACHER",
    fullName: "Docente de Teste",
    email: `${unique("docente")}@ufal.br`,
    password: "Senha@123",
    registrationCode: unique("siape"),
    cndb: unique("cndb"),
    ...overrides,
  };
}

describe("POST /auth/register", () => {
  // ---------- 201 - Created ----------

  it("creates a STUDENT and returns the flat user — no token, no envelope", async () => {
    const payload = aStudentPayload();

    const response = await request(app).post(REGISTER_URL).send(payload);

    expect(response.status).toBe(201);
    // Contrato novo: o corpo É o UserResponse. O toEqual exato reprova
    // qualquer campo extra (token, passwordHash) ou envelope { user }.
    expect(response.body).toEqual({
      id: expect.any(String),
      fullName: payload.fullName,
      email: payload.email,
      userType: "STUDENT",
      isManager: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty("token");
    expect(response.body).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
      include: { student: true },
    });
    expect(stored.student?.registrationCode).toBe(payload.registrationCode);
    expect(stored.passwordHash).not.toBe(payload.password);
  });

  it("creates a TEACHER without course (optional) and persists the subtype", async () => {
    const payload = aTeacherPayload(); // sem "course": opcional para TEACHER

    const response = await request(app).post(REGISTER_URL).send(payload);

    expect(response.status).toBe(201);
    expect(response.body.userType).toBe("TEACHER");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
      include: { teacher: true },
    });
    expect(stored.teacher?.cndb).toBe(payload.cndb);
    expect(stored.teacher?.course).toBeNull();
  });

  it("does NOT send a Set-Cookie header", async () => {
    // AC central da refatoração. Falha (Red) enquanto o controller chamar
    // res.cookie("token", ...) — comportamento atual.
    const response = await request(app).post(REGISTER_URL).send(aStudentPayload());

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("leaves the client unauthenticated: protected route right after register → 401", async () => {
    // O agente persiste cookies: se o register setasse o cookie de sessão,
    // a sonda voltaria autenticada (404 de atividade inexistente, não 401).
    const agent = request.agent(app);
    await agent.post(REGISTER_URL).send(aStudentPayload()).expect(201);

    const probe = await agent.post(probeUrl());

    expect(probe.status).toBe(401);
  });

  it("the created account can authenticate via login (register → login → protected)", async () => {
    // Prova o AC "cadastro continua funcionando": o fluxo completo do usuário.
    const payload = aStudentPayload();
    await request(app).post(REGISTER_URL).send(payload).expect(201);

    const login = await request(app)
      .post(LOGIN_URL)
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const probe = await request(app)
      .post(probeUrl())
      .set(...authHeader(login.body.token));

    expect(probe.status).toBe(404); // autenticado (não 401): conta funcional
  });

  // ---------- 400 - Bad Request ----------

  it("rejects a payload missing required fields", async () => {
    const incomplete: Record<string, unknown> = aStudentPayload();
    delete incomplete.fullName;

    const response = await request(app).post(REGISTER_URL).send(incomplete);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 400,
      message: "Validation error.",
    });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "fullName" })]),
    );
  });

  it("rejects a userType outside the STUDENT | TEACHER domain", async () => {
    const response = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload({ userType: "ADMIN" }));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
  });

  it("rejects a weak password", async () => {
    const response = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload({ password: "12345678" }));

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  it("rejects a TEACHER payload without cndb", async () => {
    const incomplete: Record<string, unknown> = aTeacherPayload();
    delete incomplete.cndb;

    const response = await request(app).post(REGISTER_URL).send(incomplete);

    expect(response.status).toBe(400);
  });

  // ---------- 409 - Conflict ----------

  it("returns 409 when the email is already registered, keeping a single row", async () => {
    const payload = aStudentPayload();
    await request(app).post(REGISTER_URL).send(payload).expect(201);

    const response = await request(app).post(REGISTER_URL).send(payload);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "Email already in use.",
    });
    const rows = await prisma.user.count({ where: { email: payload.email } });
    expect(rows).toBe(1);
  });
});