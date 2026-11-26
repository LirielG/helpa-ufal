import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import request from "supertest";
import type { User } from "@prisma/client";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import EmailService from "@/services/email/EmailService.js";
import { hashUserCode } from "@/utils/userCode.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";
import { authCookie, signToken } from "../../helpers/auth.js";

const forgotUrl = "/auth/forgot-password";
const verifyUrl = "/auth/forgot-password/verify";
const resetUrl = "/auth/reset-password";
const NEW_PASSWORD = "Nova@Senha1";
const OTHER_PASSWORD = "Outra@Senha2";

const INVALID_CODE_BODY = {
  status: 422,
  code: "INVALID_RESET_CODE",
  message: "The reset code is invalid, expired or already used.",
  errors: [
    {
      field: "code",
      code: "INVALID_RESET_CODE",
      message: "The reset code is invalid, expired or already used.",
    },
  ],
};

let send: MockInstance<EmailService["send"]>;

beforeEach(() => {
  send = vi.spyOn(EmailService.prototype, "send");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function sentCodes(): string[] {
  return send.mock.calls
    .filter(([, template]) => template === "passwordResetCode")
    .map(([, , vars]) => (vars as { code: string }).code);
}

// The code as stored: the e-mail shows it as XXXX-XXXX.
async function requestCode(email: string): Promise<string> {
  await request(app).post(forgotUrl).send({ email }).expect(204);
  const codes = sentCodes();
  return codes[codes.length - 1].replace("-", "");
}

function login(email: string, password: string) {
  return request(app).post("/auth/login").send({ email, password });
}

describe("POST /auth/forgot-password", () => {
  it("stores a code and e-mails it with the link for an existing account", async () => {
    const { user } = await createStudent({ fullName: "Ana Souza" });

    const response = await request(app)
      .post(forgotUrl)
      .send({ email: user.email });

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(await prisma.userCode.count({ where: { userId: user.id } })).toBe(1);
    expect(send).toHaveBeenCalledWith(user.email, "passwordResetCode", {
      firstName: "Ana",
      code: expect.stringMatching(
        /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
      ),
      resetUrl: expect.stringMatching(
        /\/reset-password#code=[0-9A-HJKMNP-TV-Z]{8}$/,
      ),
    });
  });

  it("answers the same 204 for an e-mail without an account, storing and sending nothing", async () => {
    const response = await request(app)
      .post(forgotUrl)
      .send({ email: "nobody@ufal.br" });

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(await prisma.userCode.count()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("finds the account whatever the casing typed", async () => {
    const { user } = await createStudent({ email: "ana@ufal.br" });

    await request(app)
      .post(forgotUrl)
      .send({ email: " Ana@UFAL.br " })
      .expect(204);

    expect(send).toHaveBeenCalledWith(
      user.email,
      "passwordResetCode",
      expect.any(Object),
    );
  });

  it("rejects a malformed e-mail with 400", async () => {
    const response = await request(app)
      .post(forgotUrl)
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "email" }),
    ]);
  });

  it("stores only the HMAC of the code", async () => {
    const { user } = await createStudent();

    const code = await requestCode(user.email);

    const stored = await prisma.userCode.findUniqueOrThrow({
      where: { userId_type: { userId: user.id, type: "PASSWORD_RESET" } },
    });
    expect(stored.tokenHash).toBe(hashUserCode(code));
    expect(JSON.stringify(stored)).not.toContain(code);
  });

  it("invalidates the previous code when a new one is requested", async () => {
    const { user } = await createStudent();
    const first = await requestCode(user.email);
    const second = await requestCode(user.email);

    await request(app).post(verifyUrl).send({ code: first }).expect(422);
    await request(app).post(verifyUrl).send({ code: second }).expect(204);
    expect(await prisma.userCode.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("POST /auth/forgot-password/verify", () => {
  let user: User;
  let code: string;

  beforeEach(async () => {
    ({ user } = await createStudent());
    code = await requestCode(user.email);
  });

  it.each([
    ["lowercase", (c: string) => c.toLowerCase()],
    ["with a hyphen", (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`],
    ["with a Unicode dash", (c: string) => `${c.slice(0, 4)}–${c.slice(4)}`],
  ])("accepts the code %s without consuming it", async (_label, typed) => {
    await request(app)
      .post(verifyUrl)
      .send({ code: typed(code) })
      .expect(204);

    expect(await prisma.userCode.count({ where: { userId: user.id } })).toBe(1);
  });

  // The drawn code may have no 0, so a known one is stored instead.
  it("accepts O in place of a 0", async () => {
    const withZero = "0ABCDEFG";
    await prisma.userCode.update({
      where: { userId_type: { userId: user.id, type: "PASSWORD_RESET" } },
      data: { tokenHash: hashUserCode(withZero) },
    });

    await request(app).post(verifyUrl).send({ code: "oabc-defg" }).expect(204);
  });

  it("rejects an expired code with 422", async () => {
    await prisma.userCode.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app).post(verifyUrl).send({ code });

    expect(response.status).toBe(422);
    expect(response.body).toEqual(INVALID_CODE_BODY);
  });

  it("rejects an unknown code with the same 422", async () => {
    const other = code === "ZZZZZZZZ" ? "YYYYYYYY" : "ZZZZZZZZ";

    const response = await request(app).post(verifyUrl).send({ code: other });

    expect(response.status).toBe(422);
    expect(response.body).toEqual(INVALID_CODE_BODY);
  });

  it("rejects a code that does not normalize with 400 on code", async () => {
    const response = await request(app)
      .post(verifyUrl)
      .send({ code: "ABC-DEF" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "code" }),
    ]);
  });
});

describe("POST /auth/reset-password", () => {
  let user: User;
  let code: string;

  beforeEach(async () => {
    ({ user } = await createStudent());
    code = await requestCode(user.email);
  });

  it("sets the new password, revokes old sessions and consumes the code", async () => {
    const oldToken = signToken({
      id: user.id,
      userType: user.userType,
      isManager: user.isManager,
      tokenVersion: user.tokenVersion,
    });

    const response = await request(app)
      .post(resetUrl)
      .send({ code, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(401);

    const me = await request(app)
      .get("/users/me")
      .set(...authCookie(oldToken));
    expect(me.status).toBe(401);
    expect(me.body.code).toBe("SESSION_INVALID");

    const repeat = await request(app)
      .post(resetUrl)
      .send({ code, newPassword: OTHER_PASSWORD });
    expect(repeat.status).toBe(422);
    expect(repeat.body).toEqual(INVALID_CODE_BODY);
  });

  it("accepts a new password equal to the current one", async () => {
    await request(app)
      .post(resetUrl)
      .send({ code, newPassword: DEFAULT_PASSWORD })
      .expect(204);
  });

  it("sends the passwordChanged notice", async () => {
    await request(app)
      .post(resetUrl)
      .send({ code, newPassword: NEW_PASSWORD })
      .expect(204);

    expect(send).toHaveBeenCalledWith(user.email, "passwordChanged", {
      firstName: user.fullName.split(" ")[0],
    });
  });

  it("lets exactly one of two concurrent resets with the same code through", async () => {
    const responses = await Promise.all([
      request(app).post(resetUrl).send({ code, newPassword: NEW_PASSWORD }),
      request(app).post(resetUrl).send({ code, newPassword: OTHER_PASSWORD }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([204, 422]);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.tokenVersion).toBe(user.tokenVersion + 1);
  });

  it("rejects an expired code with 422 and keeps the password", async () => {
    await prisma.userCode.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post(resetUrl)
      .send({ code, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(422);
    expect(response.body).toEqual(INVALID_CODE_BODY);
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(200);
  });

  it("rejects a password outside the policy with 400 on newPassword", async () => {
    const response = await request(app)
      .post(resetUrl)
      .send({ code, newPassword: "123" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "newPassword" }),
    ]);
    expect(await prisma.userCode.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects a code that does not normalize with 400 on code", async () => {
    const response = await request(app)
      .post(resetUrl)
      .send({ code: "UUUUUUUU", newPassword: NEW_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: "code" }),
    ]);
  });
});
