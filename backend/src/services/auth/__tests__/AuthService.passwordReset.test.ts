import { describe, it, expect, vi, beforeEach } from "vitest";
import bcryptjs from "bcryptjs";
import { Prisma, type User } from "@prisma/client";
import AuthService from "../AuthService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IUserCodeRepository } from "@/repositories/auth/IUserCodeRepository.js";
import type { IEmailService } from "@/services/email/IEmailService.js";
import ValidationError from "@/models/error/ValidationError.js";
import { env } from "@/config/env.js";
import { hashUserCode } from "@/utils/userCode.js";

const CODE = "ABCDEFGH";
const WRONG_CODE = "ZZZZZZZZ";

const USER: User = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  fullName: "Maria  da Silva",
  email: "maria@ufal.br",
  passwordHash: "$2a$12$hashbcryptdobanco",
  userType: "STUDENT",
  isManager: false,
  tokenVersion: 0,
  createdAt: new Date("2026-08-26T21:00:00.000Z"),
  updatedAt: new Date("2026-08-26T21:00:00.000Z"),
};

const PENDING_CODE = {
  id: "0b6c2f4e-1d3a-4c5b-9e8f-7a6b5c4d3e2f",
  tokenHash: hashUserCode(CODE),
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["userId", "type"] },
  });
}

function setup() {
  const userRepository = {
    findByEmail: vi.fn().mockResolvedValue(USER),
  } as unknown as IUserRepository & {
    findByEmail: ReturnType<typeof vi.fn>;
  };
  const userCodeRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findValid: vi.fn().mockResolvedValue(PENDING_CODE),
    reserveAttempt: vi.fn().mockResolvedValue(true),
    releaseAttempt: vi.fn().mockResolvedValue(undefined),
    deleteIfExhausted: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(USER),
  };
  const emailService = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService({
    userRepository,
    userCodeRepository: userCodeRepository as unknown as IUserCodeRepository,
    emailService: emailService as unknown as IEmailService,
  });
  return { service, userRepository, userCodeRepository, emailService };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

function expectInvalidResetCode(error: unknown) {
  expect(error).toBeInstanceOf(ValidationError);
  const validationError = error as ValidationError;
  expect(validationError.statusCode).toBe(422);
  expect(validationError.code).toBe("INVALID_RESET_CODE");
  expect(validationError.message).toBe(
    "The reset code is invalid, expired or already used.",
  );
  expect(validationError.errors).toEqual([
    {
      field: "code",
      code: "INVALID_RESET_CODE",
      message: "The reset code is invalid, expired or already used.",
    },
  ]);
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("AuthService.requestPasswordReset", () => {
  it("saves only the HMAC of a fresh code, valid for 30 minutes", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-24T12:00:00.000Z") });
    const { service, userCodeRepository, emailService } = setup();

    await service.requestPasswordReset({ email: "maria@ufal.br" });

    const saved = userCodeRepository.save.mock.calls[0][0];
    const { code } = emailService.send.mock.calls[0][2];
    const plain = code.replace("-", "");
    expect(saved).toEqual({
      userId: USER.id,
      type: "PASSWORD_RESET",
      tokenHash: hashUserCode(plain),
      expiresAt: new Date("2026-11-24T12:30:00.000Z"),
    });
    expect(saved.tokenHash).not.toContain(plain);
  });

  it("e-mails the formatted code, the first name and a link with the e-mail and the code in the fragment", async () => {
    const { service, emailService } = setup();

    await service.requestPasswordReset({ email: "maria@ufal.br" });

    expect(emailService.send).toHaveBeenCalledOnce();
    const [to, template, vars] = emailService.send.mock.calls[0];
    expect(to).toBe("maria@ufal.br");
    expect(template).toBe("passwordResetCode");
    expect(vars.firstName).toBe("Maria");
    expect(vars.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(vars.resetUrl).toBe(
      `${env.APP_PUBLIC_URL}/reset-password#email=maria%40ufal.br&code=${vars.code.replace("-", "")}`,
    );
  });

  it("encodes the e-mail in the link", async () => {
    const { service, userRepository, emailService } = setup();
    userRepository.findByEmail.mockResolvedValue({
      ...USER,
      email: "maria+helpa@ufal.br",
    });

    await service.requestPasswordReset({ email: "maria+helpa@ufal.br" });

    const { resetUrl } = emailService.send.mock.calls[0][2];
    expect(resetUrl).toContain("#email=maria%2Bhelpa%40ufal.br&code=");
  });

  it("does nothing for an e-mail without an account", async () => {
    const { service, userRepository, userCodeRepository, emailService } =
      setup();
    userRepository.findByEmail.mockResolvedValue(null);

    await service.requestPasswordReset({ email: "nobody@ufal.br" });

    expect(userCodeRepository.save).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("does not wait for nor fail on the e-mail delivery", async () => {
    const { service, emailService } = setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    emailService.send.mockRejectedValue(new Error("SMTP down"));

    await expect(
      service.requestPasswordReset({ email: "maria@ufal.br" }),
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });

  it("does not retry when saving the code fails", async () => {
    const { service, userCodeRepository, emailService } = setup();
    userCodeRepository.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.requestPasswordReset({ email: "maria@ufal.br" }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(userCodeRepository.save).toHaveBeenCalledOnce();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe("AuthService.verifyResetCode", () => {
  it("looks up the pending code of the account with that e-mail", async () => {
    const { service, userRepository, userCodeRepository } = setup();

    await service.verifyResetCode({ email: "maria@ufal.br", code: CODE });

    expect(userRepository.findByEmail).toHaveBeenCalledWith("maria@ufal.br");
    expect(userCodeRepository.findValid).toHaveBeenCalledWith(
      USER.id,
      "PASSWORD_RESET",
      expect.any(Date),
    );
    expect(userCodeRepository.reserveAttempt).toHaveBeenCalledWith(
      PENDING_CODE.id,
      PENDING_CODE.tokenHash,
      5,
    );
    expect(userCodeRepository.releaseAttempt).toHaveBeenCalledWith(
      PENDING_CODE.id,
      PENDING_CODE.tokenHash,
    );
    expect(userCodeRepository.deleteIfExhausted).not.toHaveBeenCalled();
  });

  it("rejects the right code with 422 when no attempt is left", async () => {
    const { service, userCodeRepository } = setup();
    userCodeRepository.reserveAttempt.mockResolvedValue(false);

    expectInvalidResetCode(
      await captureError(
        service.verifyResetCode({ email: "maria@ufal.br", code: CODE }),
      ),
    );
    expect(userCodeRepository.releaseAttempt).not.toHaveBeenCalled();
  });

  it("rejects an e-mail without an account with 422", async () => {
    const { service, userRepository, userCodeRepository } = setup();
    userRepository.findByEmail.mockResolvedValue(null);

    expectInvalidResetCode(
      await captureError(
        service.verifyResetCode({ email: "nobody@ufal.br", code: CODE }),
      ),
    );
    expect(userCodeRepository.findValid).not.toHaveBeenCalled();
  });

  it("rejects an account without a pending code with 422", async () => {
    const { service, userCodeRepository } = setup();
    userCodeRepository.findValid.mockResolvedValue(null);

    expectInvalidResetCode(
      await captureError(
        service.verifyResetCode({ email: "maria@ufal.br", code: CODE }),
      ),
    );
    expect(userCodeRepository.reserveAttempt).not.toHaveBeenCalled();
  });

  it("counts a wrong code against the pending one, allowing five, and rejects it with 422", async () => {
    const { service, userCodeRepository } = setup();

    expectInvalidResetCode(
      await captureError(
        service.verifyResetCode({ email: "maria@ufal.br", code: WRONG_CODE }),
      ),
    );
    expect(userCodeRepository.reserveAttempt).toHaveBeenCalledWith(
      PENDING_CODE.id,
      PENDING_CODE.tokenHash,
      5,
    );
    expect(userCodeRepository.deleteIfExhausted).toHaveBeenCalledWith(
      PENDING_CODE.id,
      PENDING_CODE.tokenHash,
      5,
    );
    expect(userCodeRepository.releaseAttempt).not.toHaveBeenCalled();
  });
});

describe("AuthService.resetPassword", () => {
  it("consumes the code with a bcrypt hash of the new password", async () => {
    const { service, userCodeRepository } = setup();

    await service.resetPassword({
      email: "maria@ufal.br",
      code: CODE,
      newPassword: "Nova@Senha1",
    });

    const [id, tokenHash, passwordHash] =
      userCodeRepository.resetPassword.mock.calls[0];
    expect(id).toBe(PENDING_CODE.id);
    expect(tokenHash).toBe(PENDING_CODE.tokenHash);
    expect(await bcryptjs.compare("Nova@Senha1", passwordHash)).toBe(true);
  });

  it("sends the passwordChanged notice to the user", async () => {
    const { service, emailService } = setup();

    await service.resetPassword({
      email: "maria@ufal.br",
      code: CODE,
      newPassword: "Nova@Senha1",
    });

    expect(emailService.send).toHaveBeenCalledWith(
      "maria@ufal.br",
      "passwordChanged",
      { firstName: "Maria" },
    );
  });

  // bcrypt is costly on purpose; a guessed code must not make the server pay it.
  it("rejects a wrong code with 422, counting it, before hashing the new password", async () => {
    const { service, userCodeRepository, emailService } = setup();
    const hash = vi.spyOn(bcryptjs, "hash");

    expectInvalidResetCode(
      await captureError(
        service.resetPassword({
          email: "maria@ufal.br",
          code: WRONG_CODE,
          newPassword: "Nova@Senha1",
        }),
      ),
    );
    expect(userCodeRepository.deleteIfExhausted).toHaveBeenCalledWith(
      PENDING_CODE.id,
      PENDING_CODE.tokenHash,
      5,
    );
    expect(hash).not.toHaveBeenCalled();
    expect(userCodeRepository.resetPassword).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
    hash.mockRestore();
  });

  it("rejects the right code with 422 before hashing when no attempt is left", async () => {
    const { service, userCodeRepository } = setup();
    userCodeRepository.reserveAttempt.mockResolvedValue(false);
    const hash = vi.spyOn(bcryptjs, "hash");

    expectInvalidResetCode(
      await captureError(
        service.resetPassword({
          email: "maria@ufal.br",
          code: CODE,
          newPassword: "Nova@Senha1",
        }),
      ),
    );
    expect(hash).not.toHaveBeenCalled();
    expect(userCodeRepository.resetPassword).not.toHaveBeenCalled();
    hash.mockRestore();
  });

  it("rejects a code used up by a concurrent request with 422 and sends nothing", async () => {
    const { service, userCodeRepository, emailService } = setup();
    userCodeRepository.resetPassword.mockResolvedValue(null);

    expectInvalidResetCode(
      await captureError(
        service.resetPassword({
          email: "maria@ufal.br",
          code: CODE,
          newPassword: "Nova@Senha1",
        }),
      ),
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
