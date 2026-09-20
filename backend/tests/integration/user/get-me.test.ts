import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import {
  authCookie,
  authHeader,
  invalidToken,
  signToken,
} from "../../helpers/auth.js";

// Route contract: docs/bruno/User/Get user's profile.yml.
const meUrl = "/users/me";

describe("GET /users/me", () => {
  it("returns the profile of the STUDENT who owns the token", async () => {
    const student = await createStudent({
      fullName: "Maria Silva",
      registrationCode: "20240012345",
      course: "Ciência da Computação",
    });

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(student.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: student.user.id,
      fullName: "Maria Silva",
      email: student.user.email,
      userType: "STUDENT",
      isManager: false,
      registrationCode: "20240012345",
      course: "Ciência da Computação",
      cndb: null,
      createdAt: student.user.createdAt.toISOString(),
    });
  });

  it("returns the profile of the TEACHER who owns the token, with cndb", async () => {
    const teacher = await createTeacher({
      fullName: "Ricardo Almeida",
      registrationCode: "1234567",
      cndb: "CNDB-9988",
      course: "Engenharia de Software",
    });

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(teacher.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: teacher.user.id,
      fullName: "Ricardo Almeida",
      email: teacher.user.email,
      userType: "TEACHER",
      isManager: false,
      registrationCode: "1234567",
      course: "Engenharia de Software",
      cndb: "CNDB-9988",
      createdAt: teacher.user.createdAt.toISOString(),
    });
  });

  it("returns course as null for a TEACHER with no course", async () => {
    const teacher = await createTeacher({ course: null });

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(teacher.token));

    expect(response.status).toBe(200);
    expect(response.body.course).toBeNull();
    expect(response.body.registrationCode).toEqual(expect.any(String));
  });

  it.each([
    ["STUDENT", createStudent],
    ["TEACHER", createTeacher],
  ])(
    "never serializes passwordHash for a %s",
    async (_userType, createUser) => {
      const { token } = await createUser();

      const response = await request(app)
        .get(meUrl)
        .set(...authHeader(token));

      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).not.toContain("passwordHash");
    },
  );

  it("flags a manager through isManager", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(manager.token));

    expect(response.status).toBe(200);
    expect(response.body.isManager).toBe(true);
  });

  // The route has no id input by design: whatever a caller sends in query,
  // body or path-like params, the profile that comes back is the token owner's.
  it("ignores any user id sent in the query or the body", async () => {
    const owner = await createStudent({ fullName: "Maria Silva" });
    const other = await createStudent({ fullName: "Outra Pessoa" });

    const response = await request(app)
      .get(`${meUrl}?userId=${other.user.id}&id=${other.user.id}`)
      .set(...authHeader(owner.token))
      .send({ userId: other.user.id, id: other.user.id });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(owner.user.id);
    expect(response.body.fullName).toBe("Maria Silva");
  });

  // The cookie wins over the header, so a Bearer token naming someone else
  // cannot override the session the browser is actually authenticated with.
  it("keeps the cookie session when a Bearer token names another user", async () => {
    const owner = await createStudent();
    const other = await createStudent();

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(owner.token))
      .set(...authHeader(other.token));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(owner.user.id);
  });

  it("accepts the session cookie as well as the Bearer token", async () => {
    const student = await createStudent();

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(student.token));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(student.user.id);
  });

  // ---------- 401 - Unauthenticated ----------

  it("rejects a request with no credential", async () => {
    const response = await request(app).get(meUrl);

    expect(response.status).toBe(401);
  });

  it("rejects a token with an invalid signature", async () => {
    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(invalidToken()));

    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const student = await createStudent();
    const expired = signToken(
      { id: student.user.id, userType: "STUDENT", isManager: false },
      "-1h",
    );

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(expired));

    expect(response.status).toBe(401);
  });

  // ---------- 404 - User gone ----------

  // Deliberately 404 and not the 401 the enrollment routes return for the same
  // situation: here the resource is the token owner, so nothing is concealed.
  it("returns 404 when the user from the token no longer exists", async () => {
    const student = await createStudent();
    await prisma.user.delete({ where: { id: student.user.id } });

    const response = await request(app)
      .get(meUrl)
      .set(...authHeader(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "User not found." });
  });
});
