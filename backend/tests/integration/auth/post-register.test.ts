// tests/integration/auth/post-register.test.ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { authHeader } from "../../helpers/auth.js";

const REGISTER_URL = "/auth/register";
const LOGIN_URL = "/auth/login";

const probeUrl = () => `/activities/${randomUUID()}/reports`;
const probeBody = { category: "SPAM" };

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
    // The body IS the UserResponse. An exact toEqual is what fails the test on
    // any extra field (token, passwordHash) or on a { user } envelope.
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
    const response = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload());

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("leaves the client unauthenticated: protected route right after register → 401", async () => {
    // The agent keeps cookies between requests: if register set the session
    // cookie, the probe would come back authenticated (404 for a nonexistent
    // activity) instead of 401.
    const agent = request.agent(app);
    await agent.post(REGISTER_URL).send(aStudentPayload()).expect(201);

    const probe = await agent.post(probeUrl()).send(probeBody);

    expect(probe.status).toBe(401);
  });

  it("the created account can authenticate via login (register → login → protected)", async () => {
    // The whole user flow, end to end.
    const payload = aStudentPayload();
    await request(app).post(REGISTER_URL).send(payload).expect(201);

    const login = await request(app)
      .post(LOGIN_URL)
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const probe = await request(app)
      .post(probeUrl())
      .set(...authHeader(login.body.token))
      .send(probeBody);

    expect(probe.status).toBe(404); // authenticated, not 401: the account works
    // Guards against a false pass: the 404 has to come from ErrorHandler (JSON),
    // not from Express's default 404 (HTML, empty body).
    expect(probe.body).toMatchObject({ status: 404 });
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

  it("rejects a STUDENT payload without course", async () => {
    const incomplete: Record<string, unknown> = aStudentPayload();
    delete incomplete.course;

    const response = await request(app).post(REGISTER_URL).send(incomplete);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
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

  it("returns 409 when a STUDENT registrationCode is already registered", async () => {
    const first = aStudentPayload();
    await request(app).post(REGISTER_URL).send(first).expect(201);

    const second = aStudentPayload({
      registrationCode: first.registrationCode,
    });
    const response = await request(app).post(REGISTER_URL).send(second);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "Registration code already in use.",
    });

    // Nothing was created for the failed attempt: the transaction rolled
    // back the User row too, and the email stays available.
    const users = await prisma.user.count({ where: { email: second.email } });
    expect(users).toBe(0);
    const students = await prisma.student.count({
      where: { registrationCode: first.registrationCode },
    });
    expect(students).toBe(1);
  });

  it("returns 409 when a TEACHER registrationCode is already registered", async () => {
    const first = aTeacherPayload();
    await request(app).post(REGISTER_URL).send(first).expect(201);

    const second = aTeacherPayload({
      registrationCode: first.registrationCode,
    });
    const response = await request(app).post(REGISTER_URL).send(second);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "Registration code already in use.",
    });

    const users = await prisma.user.count({ where: { email: second.email } });
    expect(users).toBe(0);
  });

  it("returns 409 when a TEACHER cndb is already registered", async () => {
    const first = aTeacherPayload();
    await request(app).post(REGISTER_URL).send(first).expect(201);

    const second = aTeacherPayload({ cndb: first.cndb });
    const response = await request(app).post(REGISTER_URL).send(second);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 409,
      message: "CNDB already in use.",
    });

    const users = await prisma.user.count({ where: { email: second.email } });
    expect(users).toBe(0);
  });

  it("gives a different message for a registrationCode conflict than for an email conflict", async () => {
    const first = aStudentPayload();
    await request(app).post(REGISTER_URL).send(first).expect(201);

    const emailConflict = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload({ email: first.email }));

    const codeConflict = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload({ registrationCode: first.registrationCode }));

    expect(emailConflict.status).toBe(409);
    expect(codeConflict.status).toBe(409);
    expect(emailConflict.body.message).not.toBe(codeConflict.body.message);
  });

  it("does not leak Prisma internals (constraint name, sql, stack) in the response body", async () => {
    const first = aStudentPayload();
    await request(app).post(REGISTER_URL).send(first).expect(201);

    const response = await request(app)
      .post(REGISTER_URL)
      .send(aStudentPayload({ registrationCode: first.registrationCode }));

    expect(Object.keys(response.body).sort()).toEqual(["message", "status"]);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/_key/);
    expect(raw).not.toMatch(/select |insert |constraint/i);
  });
});
