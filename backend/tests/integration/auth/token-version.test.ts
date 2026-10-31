import { describe, expect, it } from "vitest";
import request from "supertest";
import type { User } from "@prisma/client";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";
import { authCookie, signToken } from "../../helpers/auth.js";

// Session revocation: a token signed before the user's tokenVersion moved
// on answers 401. GET /users/me is the probe because it reads the user.

const meUrl = "/users/me";
const loginUrl = "/auth/login";
const REVOKED_TOKEN_BODY = {
  status: 401,
  code: "UNAUTHENTICATED",
  message: "Token malformatted, expired or invalid.",
};

function getMe(token: string) {
  return request(app)
    .get(meUrl)
    .set(...authCookie(token));
}

function tokenAtVersion(user: User, tokenVersion: number): string {
  const { id, userType, isManager } = user;
  return signToken({ id, userType, isManager, tokenVersion });
}

async function bumpTokenVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

describe("token version", () => {
  it("accepts a token signed with the user's current version", async () => {
    const { user } = await createStudent();
    const token = tokenAtVersion(user, 0);

    expect((await getMe(token)).status).toBe(200);
  });

  it("rejects the same token once the user's version moves on", async () => {
    const { user } = await createStudent();
    const token = tokenAtVersion(user, 0);

    await bumpTokenVersion(user.id);

    const response = await getMe(token);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(REVOKED_TOKEN_BODY);
  });

  it("treats a token without the claim as version 0", async () => {
    const student = await createStudent(); // factory tokens carry no claim

    expect((await getMe(student.token)).status).toBe(200);

    await bumpTokenVersion(student.user.id);

    expect((await getMe(student.token)).status).toBe(401);
  });

  it("signs the new version on a login made after the bump", async () => {
    const { user } = await createStudent();
    await bumpTokenVersion(user.id);

    const login = await request(app)
      .post(loginUrl)
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);

    expect(
      (await request(app).get(meUrl).set("Cookie", login.headers["set-cookie"]))
        .status,
    ).toBe(200);
  });

  it("does not affect other users' tokens", async () => {
    const owner = await createStudent();
    const other = await createStudent();

    await bumpTokenVersion(owner.user.id);

    expect((await getMe(other.token)).status).toBe(200);
  });

  it("keeps answering 404 for a token whose user no longer exists", async () => {
    const student = await createStudent();
    await prisma.user.delete({ where: { id: student.user.id } });

    expect((await getMe(student.token)).status).toBe(404);
  });
});
