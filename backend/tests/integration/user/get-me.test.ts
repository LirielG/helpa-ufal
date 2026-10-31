import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import {
  createActivity,
  createEnrollment,
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken, signToken } from "../../helpers/auth.js";

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
      .set(...authCookie(student.token));

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
      totalWorkloadHours: 0,
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
      .set(...authCookie(teacher.token));

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
      totalWorkloadHours: 0,
    });
  });

  it("returns course as null for a TEACHER with no course", async () => {
    const teacher = await createTeacher({ course: null });

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(teacher.token));

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
        .set(...authCookie(token));

      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).not.toContain("passwordHash");
    },
  );

  it("flags a manager through isManager", async () => {
    const manager = await createManager();

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(manager.token));

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
      .set(...authCookie(owner.token))
      .send({ userId: other.user.id, id: other.user.id });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(owner.user.id);
    expect(response.body.fullName).toBe("Maria Silva");
  });

  // Authorization headers cannot override the browser session cookie.
  it("keeps the cookie session when an authorization header names another user", async () => {
    const owner = await createStudent();
    const other = await createStudent();

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(owner.token))
      .set("Authorization", `${["Bear", "er"].join("")} ${other.token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(owner.user.id);
  });

  it("accepts the session cookie on protected routes", async () => {
    const student = await createStudent();

    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(student.token));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(student.user.id);
  });

  // ---------- totalWorkloadHours ----------

  describe("totalWorkloadHours", () => {
    async function totalOf(token: string): Promise<number> {
      const response = await request(app)
        .get(meUrl)
        .set(...authCookie(token));
      expect(response.status).toBe(200);
      return response.body.totalWorkloadHours;
    }

    /** An enrollment of `userId` in a fresh COMPLETED activity. */
    async function enrollIn(
      userId: string,
      enrollment: Parameters<typeof createEnrollment>[2],
      activity: { deletedAt?: Date } = {},
    ) {
      const author = await createTeacher();
      const created = await createActivity(author.user.id, {
        status: "COMPLETED",
        ...activity,
      });
      return createEnrollment(userId, created.id, enrollment);
    }

    it("is 0 for a user with no enrollment", async () => {
      const student = await createStudent();

      const response = await request(app)
        .get(meUrl)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.totalWorkloadHours).toBe(0);
    });

    it("adds up the hours of every homologated presence", async () => {
      const student = await createStudent();
      await enrollIn(student.user.id, {
        attendanceConfirmed: true,
        confirmedWorkloadHours: 8,
      });
      await enrollIn(student.user.id, {
        attendanceConfirmed: true,
        confirmedWorkloadHours: 4,
      });

      expect(await totalOf(student.token)).toBe(12);
    });

    // The hours are written by hand to prove the filter, not the 0 that
    // homologation would store, is what keeps them out.
    it.each([
      ["not homologated", null],
      ["absent", false],
    ])(
      "leaves out an APPROVED enrollment whose attendance is %s",
      async (_label, attendanceConfirmed) => {
        const student = await createStudent();
        await enrollIn(student.user.id, {
          attendanceConfirmed,
          confirmedWorkloadHours: 8,
        });

        expect(await totalOf(student.token)).toBe(0);
      },
    );

    it("leaves out a CANCELLED enrollment even with hours recorded", async () => {
      const student = await createStudent();
      await enrollIn(student.user.id, {
        status: "CANCELLED",
        attendanceConfirmed: true,
        confirmedWorkloadHours: 8,
      });

      expect(await totalOf(student.token)).toBe(0);
    });

    it("keeps the hours of an activity deleted after homologation", async () => {
      const student = await createStudent();
      await enrollIn(
        student.user.id,
        { attendanceConfirmed: true, confirmedWorkloadHours: 6 },
        { deletedAt: new Date() },
      );

      expect(await totalOf(student.token)).toBe(6);
    });

    it("never counts another user's hours", async () => {
      const student = await createStudent();
      const other = await createStudent();
      await enrollIn(other.user.id, {
        attendanceConfirmed: true,
        confirmedWorkloadHours: 10,
      });

      expect(await totalOf(student.token)).toBe(0);
      expect(await totalOf(other.token)).toBe(10);
    });

    it("counts a TEACHER's homologated presences too", async () => {
      const teacher = await createTeacher();
      await enrollIn(teacher.user.id, {
        attendanceConfirmed: true,
        confirmedWorkloadHours: 3,
      });

      expect(await totalOf(teacher.token)).toBe(3);
    });
  });

  // ---------- 401 - Unauthenticated ----------

  it("rejects a request with no credential", async () => {
    const response = await request(app).get(meUrl);

    expect(response.status).toBe(401);
  });

  it("rejects a token with an invalid signature", async () => {
    const response = await request(app)
      .get(meUrl)
      .set(...authCookie(invalidToken()));

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
      .set(...authCookie(expired));

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
      .set(...authCookie(student.token));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "User not found.",
    });
  });
});
