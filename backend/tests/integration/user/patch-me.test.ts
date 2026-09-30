import { describe, expect, it } from "vitest";
import request from "supertest";
import bcryptjs from "bcryptjs";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createManager,
  createStudent,
  createTeacher,
  DEFAULT_PASSWORD,
} from "../../helpers/factories.js";
import {
  authCookie,
  authHeader,
  invalidToken,
  signToken,
} from "../../helpers/auth.js";

/**
 * Spec for issue #95 (PATCH /users/me).
 * Route contract: docs/bruno/User/Update user's profile.yml.
 *
 * Red until #59 (route) and the tokenVersion issue (session revocation) land.
 * Error bodies are asserted with toEqual so the red never false-passes on the
 * Express default 404.
 *
 * CHECK BEFORE RUNNING: the auth routes are assumed to be mounted under /auth
 * (AuthRouter only shows "/login", "/register", "/logout"). Fix the three
 * constants below if the prefix is different.
 *
 * Deliberately NOT covered (registered debt): malformed JSON answers 500 until
 * the guard planned in #146 lands.
 */
const meUrl = "/users/me";
const loginUrl = "/auth/login";
const logoutUrl = "/auth/logout";
const registerUrl = "/auth/register";

const NEW_PASSWORD = "Nova@1234";
const IMMUTABLE = "This field cannot be updated.";
const EMPTY_BODY = "At least one updatable field must be provided.";
const CURRENT_REQUIRED = "Current password is required to set a new password.";
const POLICY_MESSAGE =
  "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.";
const REVOKED_TOKEN_BODY = {
  status: 401,
  message: "Token malformatted, expired or invalid.",
};

function validationError(errors: Array<{ field: string; message: string }>) {
  return { status: 400, message: "Validation error.", errors };
}

function patchMe(token: string, body?: unknown) {
  const req = request(app)
    .patch(meUrl)
    .set(...authHeader(token));
  return body === undefined ? req : req.send(body as object);
}

function changePassword(
  token: string,
  currentPassword: string,
  newPassword = NEW_PASSWORD,
  extra: Record<string, unknown> = {},
) {
  return patchMe(token, { currentPassword, newPassword, ...extra });
}

function getMe(token: string) {
  return request(app)
    .get(meUrl)
    .set(...authHeader(token));
}

function login(email: string, password: string) {
  return request(app).post(loginUrl).send({ email, password });
}

async function loginToken(email: string, password = DEFAULT_PASSWORD) {
  const response = await login(email, password);
  expect(response.status).toBe(200);
  return response.body.token as string;
}

function readUser(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    include: { student: true, teacher: true },
  });
}

function tokenCookie(response: request.Response): string | undefined {
  const cookies = (response.headers["set-cookie"] ?? []) as unknown as string[];
  return cookies.find((cookie) => cookie.startsWith("token="));
}

describe("PATCH /users/me", () => {
  // ---------- Personal data ----------

  describe("personal data", () => {
    it("updates fullName and persists it, verified by re-reading GET /users/me", async () => {
      const student = await createStudent({ fullName: "Maria Silva" });

      const response = await patchMe(student.token, {
        fullName: "Maria Silva Souza",
      });

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe("Maria Silva Souza");
      const reread = await getMe(student.token);
      expect(reread.body.fullName).toBe("Maria Silva Souza");
    });

    it("trims fullName before saving it", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {
        fullName: "  Maria Souza  ",
      });

      expect(response.status).toBe(200);
      expect((await readUser(student.user.id)).fullName).toBe("Maria Souza");
    });

    it("accepts a fullName equal to the current one", async () => {
      const student = await createStudent({ fullName: "Maria Silva" });

      const response = await patchMe(student.token, { fullName: "Maria Silva" });

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe("Maria Silva");
    });

    it.each([
      ["empty", ""],
      ["only spaces", "   "],
      ["not a string", 123],
    ])("rejects a fullName that is %s and keeps the stored one", async (_l, fullName) => {
      const student = await createStudent({ fullName: "Maria Silva" });

      const response = await patchMe(student.token, { fullName });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        expect.objectContaining({ field: "fullName" }),
      ]);
      expect((await readUser(student.user.id)).fullName).toBe("Maria Silva");
    });
  });

  // ---------- course ----------

  describe("course", () => {
    it.each([
      ["a new value", "Engenharia de Computação"],
      ["null", null],
      ["the current value", "Ciência da Computação"],
      ["an empty string", ""],
    ])("rejects course sent by a STUDENT as %s and persists nothing", async (_l, course) => {
      const student = await createStudent({
        fullName: "Maria Silva",
        course: "Ciência da Computação",
      });

      const response = await patchMe(student.token, {
        fullName: "Should Not Apply",
        course,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        validationError([{ field: "course", message: IMMUTABLE }]),
      );
      const stored = await readUser(student.user.id);
      expect(stored.fullName).toBe("Maria Silva");
      expect(stored.student?.course).toBe("Ciência da Computação");
    });

    it("lets a TEACHER change the course, and it persists", async () => {
      const teacher = await createTeacher({ course: "Engenharia de Software" });

      const response = await patchMe(teacher.token, {
        course: "Engenharia de Computação",
      });

      expect(response.status).toBe(200);
      expect(response.body.course).toBe("Engenharia de Computação");
      expect((await getMe(teacher.token)).body.course).toBe(
        "Engenharia de Computação",
      );
    });

    it("lets a TEACHER clear the course with null, and it persists", async () => {
      const teacher = await createTeacher({ course: "Engenharia de Software" });

      const response = await patchMe(teacher.token, { course: null });

      expect(response.status).toBe(200);
      expect(response.body.course).toBeNull();
      expect((await getMe(teacher.token)).body.course).toBeNull();
      expect((await readUser(teacher.user.id)).teacher?.course).toBeNull();
    });

    it("trims a TEACHER's course", async () => {
      const teacher = await createTeacher();

      const response = await patchMe(teacher.token, { course: "  Física  " });

      expect(response.status).toBe(200);
      expect(response.body.course).toBe("Física");
    });

    it.each([
      ["an empty string", ""],
      ["only spaces", "   "],
    ])("rejects a TEACHER's course that is %s and keeps the stored one", async (_l, course) => {
      const teacher = await createTeacher({ course: "Engenharia de Software" });

      const response = await patchMe(teacher.token, { course });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        expect.objectContaining({ field: "course" }),
      ]);
      expect((await readUser(teacher.user.id)).teacher?.course).toBe(
        "Engenharia de Software",
      );
    });
  });

  // ---------- Immutable fields ----------

  describe("fields outside the whitelist", () => {
    it.each([
      ["email", "novo@ufal.br"],
      ["userType", "TEACHER"],
      ["isManager", true],
      ["registrationCode", "999999"],
      ["cndb", "CNDB-0001"],
      ["id", "7c9e6679-7425-40de-944b-e07fc1f90ae7"],
      ["createdAt", "2020-01-01T00:00:00.000Z"],
      ["surprise", "unknown key"],
    ])("rejects %s with 400 and persists nothing, not even the valid fullName sent with it", async (field, value) => {
      const student = await createStudent({ fullName: "Maria Silva" });
      const before = await readUser(student.user.id);

      const response = await patchMe(student.token, {
        fullName: "Should Not Apply",
        [field]: value,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        validationError([{ field, message: IMMUTABLE }]),
      );
      const after = await readUser(student.user.id);
      expect(after.fullName).toBe("Maria Silva");
      expect(after.email).toBe(before.email);
      expect(after.userType).toBe("STUDENT");
      expect(after.isManager).toBe(false);
      expect(after.student?.registrationCode).toBe(
        before.student?.registrationCode,
      );
    });

    it("rejects cndb and registrationCode sent by a TEACHER", async () => {
      const teacher = await createTeacher({
        registrationCode: "1234567",
        cndb: "CNDB-9988",
      });

      const response = await patchMe(teacher.token, {
        cndb: "CNDB-0001",
        registrationCode: "7654321",
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          { field: "cndb", message: IMMUTABLE },
          { field: "registrationCode", message: IMMUTABLE },
        ]),
      );
      const stored = await readUser(teacher.user.id);
      expect(stored.teacher?.cndb).toBe("CNDB-9988");
      expect(stored.teacher?.registrationCode).toBe("1234567");
    });

    it("does not let a non-manager become a manager with isManager: true", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, { isManager: true });

      expect(response.status).toBe(400);
      expect((await readUser(student.user.id)).isManager).toBe(false);
      expect((await getMe(student.token)).body.isManager).toBe(false);
    });

    it("does not let a manager touch isManager either, not even to drop it", async () => {
      const manager = await createManager();

      const response = await patchMe(manager.token, { isManager: false });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([{ field: "isManager", message: IMMUTABLE }]),
      );
      expect((await readUser(manager.user.id)).isManager).toBe(true);
    });

    it("reports every offending key in errors[], not just the first", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {
        fullName: "Should Not Apply",
        isManager: true,
        email: "x@ufal.br",
        userType: "TEACHER",
      });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe(400);
      expect(response.body.message).toBe("Validation error.");
      expect(response.body.errors).toHaveLength(3);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          { field: "isManager", message: IMMUTABLE },
          { field: "email", message: IMMUTABLE },
          { field: "userType", message: IMMUTABLE },
        ]),
      );
    });

    it("rejects the whole request when a password change comes with a forbidden key, and the password stays", async () => {
      const student = await createStudent();

      const response = await changePassword(
        student.token,
        DEFAULT_PASSWORD,
        NEW_PASSWORD,
        { isManager: true },
      );

      expect(response.status).toBe(400);
      expect((await login(student.user.email, DEFAULT_PASSWORD)).status).toBe(200);
      expect((await login(student.user.email, NEW_PASSWORD)).status).toBe(401);
    });
  });

  // ---------- Body without an updatable field ----------

  describe("body without an updatable field", () => {
    const emptyBodyError = validationError([
      { field: "body", message: EMPTY_BODY },
    ]);

    it("rejects an empty object", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {});

      expect(response.status).toBe(400);
      expect(response.body).toEqual(emptyBodyError);
    });

    it("rejects a request with no body at all", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(emptyBodyError);
    });

    it("rejects a body with only currentPassword", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {
        currentPassword: DEFAULT_PASSWORD,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(emptyBodyError);
    });

    it("rejects a body that is an array", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, []);

      expect(response.status).toBe(400);
    });
  });

  // ---------- Password ----------
  // The proof is the effect (login before and after), not the 200.

  describe("password change", () => {
    it("changes the password: 200, and the new password logs in", async () => {
      const student = await createStudent();

      const response = await changePassword(student.token, DEFAULT_PASSWORD);

      expect(response.status).toBe(200);
      const loginResponse = await login(student.user.email, NEW_PASSWORD);
      expect(loginResponse.status).toBe(200);
    });

    it("makes the old password stop working", async () => {
      const student = await createStudent();

      await changePassword(student.token, DEFAULT_PASSWORD);

      const loginResponse = await login(student.user.email, DEFAULT_PASSWORD);
      expect(loginResponse.status).toBe(401);
    });

    it("stores a bcrypt hash of the new password, never the plain text", async () => {
      const student = await createStudent();
      const before = (await readUser(student.user.id)).passwordHash;

      await changePassword(student.token, DEFAULT_PASSWORD);

      const after = (await readUser(student.user.id)).passwordHash;
      expect(after).not.toBe(NEW_PASSWORD);
      expect(after).not.toBe(before);
      expect(await bcryptjs.compare(NEW_PASSWORD, after)).toBe(true);
      expect(await bcryptjs.compare(DEFAULT_PASSWORD, after)).toBe(false);
    });

    it("hashes with the same cost as registration", async () => {
      const email = `cost-${Date.now()}@ufal.br`;
      const registered = await request(app).post(registerUrl).send({
        userType: "STUDENT",
        fullName: "Custo Bcrypt",
        email,
        password: DEFAULT_PASSWORD,
        course: "Ciência da Computação",
        registrationCode: `cost-${Date.now()}`,
      });
      expect(registered.status).toBe(201);
      const before = await prisma.user.findUniqueOrThrow({ where: { email } });
      const token = await loginToken(email);

      const response = await changePassword(token, DEFAULT_PASSWORD);

      expect(response.status).toBe(200);
      const after = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(bcryptjs.getRounds(after.passwordHash)).toBe(
        bcryptjs.getRounds(before.passwordHash),
      );
    });

    it("applies fullName and the password change from the same request", async () => {
      const student = await createStudent({ fullName: "Maria Silva" });

      const response = await changePassword(
        student.token,
        DEFAULT_PASSWORD,
        NEW_PASSWORD,
        { fullName: "Maria Silva Souza" },
      );

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe("Maria Silva Souza");
      expect((await login(student.user.email, NEW_PASSWORD)).status).toBe(200);
    });

    it("does not apply the password policy to currentPassword", async () => {
      const student = await createStudent({ password: "abc" });

      const response = await changePassword(student.token, "abc");

      expect(response.status).toBe(200);
      expect((await login(student.user.email, NEW_PASSWORD)).status).toBe(200);
    });

    it("rejects an incorrect currentPassword with 403 and keeps the old password valid", async () => {
      const student = await createStudent();
      const before = (await readUser(student.user.id)).passwordHash;

      const response = await changePassword(student.token, "Wrong@1234");

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        status: 403,
        message: "Current password is incorrect.",
      });
      expect((await readUser(student.user.id)).passwordHash).toBe(before);
      expect((await login(student.user.email, DEFAULT_PASSWORD)).status).toBe(200);
      expect((await login(student.user.email, NEW_PASSWORD)).status).toBe(401);
    });

    it("persists nothing from the request when currentPassword is wrong, not even fullName or course", async () => {
      const teacher = await createTeacher({
        fullName: "Ricardo Almeida",
        course: "Engenharia de Software",
      });

      const response = await changePassword(
        teacher.token,
        "Wrong@1234",
        NEW_PASSWORD,
        { fullName: "Should Not Apply", course: null },
      );

      expect(response.status).toBe(403);
      const stored = await readUser(teacher.user.id);
      expect(stored.fullName).toBe("Ricardo Almeida");
      expect(stored.teacher?.course).toBe("Engenharia de Software");
    });

    it("answers 403, not 422, when currentPassword is wrong and newPassword equals the stored password", async () => {
      const student = await createStudent();

      const response = await changePassword(
        student.token,
        "Wrong@1234",
        DEFAULT_PASSWORD,
      );

      expect(response.status).toBe(403);
    });

    it("rejects a newPassword equal to the current one with 422 and keeps the hash", async () => {
      const student = await createStudent();
      const before = (await readUser(student.user.id)).passwordHash;

      const response = await changePassword(
        student.token,
        DEFAULT_PASSWORD,
        DEFAULT_PASSWORD,
      );

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        status: 422,
        message: "New password must be different from the current password.",
      });
      expect((await readUser(student.user.id)).passwordHash).toBe(before);
    });

    it.each([
      ["too short", "Ab1!"],
      ["without an uppercase letter", "senha@1234"],
      ["without a lowercase letter", "SENHA@1234"],
      ["without a number", "Senha@abcd"],
      ["without a special character", "Senha12345"],
      ["with a non-ASCII character", "Senha@12é4"],
    ])("rejects a newPassword %s with 400 and leaves the password unchanged", async (_l, newPassword) => {
      const student = await createStudent();

      const response = await changePassword(
        student.token,
        DEFAULT_PASSWORD,
        newPassword,
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        validationError([{ field: "newPassword", message: POLICY_MESSAGE }]),
      );
      expect((await login(student.user.email, DEFAULT_PASSWORD)).status).toBe(200);
    });

    it("rejects a newPassword sent without currentPassword", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {
        newPassword: NEW_PASSWORD,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        validationError([
          { field: "currentPassword", message: CURRENT_REQUIRED },
        ]),
      );
      expect((await login(student.user.email, DEFAULT_PASSWORD)).status).toBe(200);
    });

    it("rejects an empty currentPassword sent with a newPassword", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, {
        currentPassword: "",
        newPassword: NEW_PASSWORD,
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        expect.objectContaining({ field: "currentPassword" }),
      ]);
    });
  });

  // ---------- Session after a password change ----------

  describe("session after a password change", () => {
    it("revokes the token that made the change and any other issued before it", async () => {
      const student = await createStudent(); // legacy token: no tokenVersion claim
      const sessionToken = await loginToken(student.user.email);
      expect((await getMe(student.token)).status).toBe(200);
      expect((await getMe(sessionToken)).status).toBe(200);

      const response = await changePassword(sessionToken, DEFAULT_PASSWORD);

      expect(response.status).toBe(200);
      const viaSession = await getMe(sessionToken);
      expect(viaSession.status).toBe(401);
      expect(viaSession.body).toEqual(REVOKED_TOKEN_BODY);
      expect((await getMe(student.token)).status).toBe(401);
    });

    it("revokes the session cookie too, not only the Bearer token", async () => {
      const student = await createStudent();

      await changePassword(student.token, DEFAULT_PASSWORD);

      const viaCookie = await request(app)
        .get(meUrl)
        .set(...authCookie(student.token));
      expect(viaCookie.status).toBe(401);
    });

    it("does not let a revoked token change anything else afterwards", async () => {
      const student = await createStudent({ fullName: "Maria Silva" });
      await changePassword(student.token, DEFAULT_PASSWORD);

      const response = await patchMe(student.token, { fullName: "Hijacked" });

      expect(response.status).toBe(401);
      expect((await readUser(student.user.id)).fullName).toBe("Maria Silva");
    });

    it("accepts a token from a login made after the change", async () => {
      const student = await createStudent();
      await changePassword(student.token, DEFAULT_PASSWORD);

      const freshToken = await loginToken(student.user.email, NEW_PASSWORD);

      expect((await getMe(freshToken)).status).toBe(200);
    });

    it("keeps the session alive when only fullName or course changes", async () => {
      const teacher = await createTeacher();
      const sessionToken = await loginToken(teacher.user.email);

      const response = await patchMe(sessionToken, {
        fullName: "Ricardo Editado",
        course: null,
      });

      expect(response.status).toBe(200);
      expect((await getMe(sessionToken)).status).toBe(200);
      expect((await getMe(teacher.token)).status).toBe(200);
    });

    it("does not touch other users' sessions", async () => {
      const owner = await createStudent();
      const other = await createStudent();

      await changePassword(owner.token, DEFAULT_PASSWORD);

      expect((await getMe(other.token)).status).toBe(200);
    });

    it("clears the session cookie on the 200 of a password change, exactly like logout", async () => {
      const student = await createStudent();
      const logout = await request(app).post(logoutUrl);
      const expected = tokenCookie(logout);
      expect(expected).toBeDefined();

      const response = await changePassword(student.token, DEFAULT_PASSWORD);

      expect(response.status).toBe(200);
      expect(tokenCookie(response)).toBe(expected);
    });

    it("does not touch the cookie when the password is not changed", async () => {
      const student = await createStudent();

      const response = await patchMe(student.token, { fullName: "Maria" });

      expect(response.status).toBe(200);
      expect(tokenCookie(response)).toBeUndefined();
    });
  });

  // ---------- Authentication and identity ----------

  describe("authentication and identity", () => {
    it("rejects a request with no credential", async () => {
      const response = await request(app)
        .patch(meUrl)
        .send({ fullName: "Maria" });

      expect(response.status).toBe(401);
    });

    it("rejects a token with an invalid signature", async () => {
      const response = await patchMe(invalidToken(), { fullName: "Maria" });

      expect(response.status).toBe(401);
    });

    it("rejects an expired token", async () => {
      const student = await createStudent();
      const expired = signToken(
        { id: student.user.id, userType: "STUDENT", isManager: false },
        "-1h",
      );

      const response = await patchMe(expired, { fullName: "Maria" });

      expect(response.status).toBe(401);
      expect((await readUser(student.user.id)).fullName).not.toBe("Maria");
    });

    it("accepts the session cookie as well as the Bearer token", async () => {
      const student = await createStudent();

      const response = await request(app)
        .patch(meUrl)
        .set(...authCookie(student.token))
        .send({ fullName: "Maria Cookie" });

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe("Maria Cookie");
    });

    it("edits only the token owner, ignoring a user id sent in the query", async () => {
      const owner = await createStudent({ fullName: "Maria Silva" });
      const other = await createStudent({ fullName: "Outra Pessoa" });

      const response = await request(app)
        .patch(`${meUrl}?userId=${other.user.id}&id=${other.user.id}`)
        .set(...authHeader(owner.token))
        .send({ fullName: "Maria Editada" });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(owner.user.id);
      expect((await readUser(owner.user.id)).fullName).toBe("Maria Editada");
      expect((await readUser(other.user.id)).fullName).toBe("Outra Pessoa");
    });

    it("cannot be pointed at someone else through an id in the body", async () => {
      const owner = await createStudent({ fullName: "Maria Silva" });
      const other = await createStudent({ fullName: "Outra Pessoa" });

      const response = await patchMe(owner.token, {
        id: other.user.id,
        fullName: "Sequestrada",
      });

      expect(response.status).toBe(400);
      expect((await readUser(other.user.id)).fullName).toBe("Outra Pessoa");
      expect((await readUser(owner.user.id)).fullName).toBe("Maria Silva");
    });

    it("returns 404 when the user from the token no longer exists", async () => {
      const student = await createStudent();
      await prisma.user.delete({ where: { id: student.user.id } });

      const response = await patchMe(student.token, { fullName: "Maria" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ status: 404, message: "User not found." });
    });
  });

  // ---------- Response shape ----------

  describe("response", () => {
    it("returns the full STUDENT profile, in the shape of GET /users/me", async () => {
      const student = await createStudent({
        fullName: "Maria Silva",
        registrationCode: "20240012345",
        course: "Ciência da Computação",
      });

      const response = await patchMe(student.token, {
        fullName: "Maria Silva Souza",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: student.user.id,
        fullName: "Maria Silva Souza",
        email: student.user.email,
        userType: "STUDENT",
        isManager: false,
        registrationCode: "20240012345",
        course: "Ciência da Computação",
        cndb: null,
        createdAt: student.user.createdAt.toISOString(),
      });
      expect(response.body).toEqual((await getMe(student.token)).body);
    });

    it("returns the full TEACHER profile, with cndb and the updated course", async () => {
      const teacher = await createTeacher({
        fullName: "Ricardo Almeida",
        registrationCode: "1234567",
        cndb: "CNDB-9988",
        course: "Engenharia de Software",
      });

      const response = await patchMe(teacher.token, { course: null });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: teacher.user.id,
        fullName: "Ricardo Almeida",
        email: teacher.user.email,
        userType: "TEACHER",
        isManager: false,
        registrationCode: "1234567",
        course: null,
        cndb: "CNDB-9988",
        createdAt: teacher.user.createdAt.toISOString(),
      });
    });

    it.each([
      ["STUDENT", createStudent],
      ["TEACHER", createTeacher],
    ])("never serializes passwordHash for a %s, with or without a password change", async (_type, createUser) => {
      const { token } = await createUser();

      const plain = await patchMe(token, { fullName: "Nome Novo" });
      expect(plain.status).toBe(200);
      expect(Object.keys(plain.body)).not.toContain("passwordHash");

      const changed = await changePassword(token, DEFAULT_PASSWORD);
      expect(changed.status).toBe(200);
      expect(Object.keys(changed.body)).not.toContain("passwordHash");
    });
  });
});
