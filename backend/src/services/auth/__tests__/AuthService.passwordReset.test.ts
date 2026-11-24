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

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["tokenHash"] },
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
    existsValid: vi.fn().mockResolvedValue(true),
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

  it("e-mails the formatted code, the first name and a link with the code in the fragment", async () => {
    const { service, emailService } = setup();

    await service.requestPasswordReset({ email: "maria@ufal.br" });

    expect(emailService.send).toHaveBeenCalledOnce();
    const [to, template, vars] = emailService.send.mock.calls[0];
    expect(to).toBe("maria@ufal.br");
    expect(template).toBe("passwordResetCode");
    expect(vars.firstName).toBe("Maria");
    expect(vars.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(vars.resetUrl).toBe(
      `${env.APP_PUBLIC_URL}/reset-password#code=${vars.code.replace("-", "")}`,
    );
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

  it("draws another code when the hash collides, up to three attempts", async () => {
    const { service, userCodeRepository } = setup();
    userCodeRepository.save
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce(undefined);

    await service.requestPasswordReset({ email: "maria@ufal.br" });

    expect(userCodeRepository.save).toHaveBeenCalledTimes(3);
  });

  it("gives up after three collisions", async () => {
    const { service, userCodeRepository, emailService } = setup();
    userCodeRepository.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.requestPasswordReset({ email: "maria@ufal.br" }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(userCodeRepository.save).toHaveBeenCalledTimes(3);
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe("AuthService.verifyResetCode", () => {
  it("looks the code up by its HMAC among unexpired password reset codes", async () => {
    const { service, userCodeRepository } = setup();

    await service.verifyResetCode({ code: "ABCDEFGH" });

    expect(userCodeRepository.existsValid).toHaveBeenCalledWith(
      "PASSWORD_RESET",
      hashUserCode("ABCDEFGH"),
      expect.any(Date),
    );
  });

  it("rejects an unknown, expired or used code with 422", async () => {
    const { service, userCodeRepository } = setup();
    userCodeRepository.existsValid.mockResolvedValue(false);

    expectInvalidResetCode(
      await captureError(service.verifyResetCode({ code: "ABCDEFGH" })),
    );
  });
});

describe("AuthService.resetPassword", () => {
  it("consumes the code with a bcrypt hash of the new password", async () => {
    const { service, userCodeRepository } = setup();

    await service.resetPassword({
      code: "ABCDEFGH",
      newPassword: "Nova@Senha1",
    });

    const [tokenHash, passwordHash] =
      userCodeRepository.resetPassword.mock.calls[0];
    expect(tokenHash).toBe(hashUserCode("ABCDEFGH"));
    expect(await bcryptjs.compare("Nova@Senha1", passwordHash)).toBe(true);
  });

  it("sends the passwordChanged notice to the user", async () => {
    const { service, emailService } = setup();

    await service.resetPassword({
      code: "ABCDEFGH",
      newPassword: "Nova@Senha1",
    });

    expect(emailService.send).toHaveBeenCalledWith(
      "maria@ufal.br",
      "passwordChanged",
      { firstName: "Maria" },
    );
  });

  // bcrypt is costly on purpose; a guessed code must not make the server pay it.
  it("rejects an invalid code with 422 before hashing the new password", async () => {
    const { service, userCodeRepository, emailService } = setup();
    userCodeRepository.existsValid.mockResolvedValue(false);
    const hash = vi.spyOn(bcryptjs, "hash");

    expectInvalidResetCode(
      await captureError(
        service.resetPassword({ code: "ABCDEFGH", newPassword: "Nova@Senha1" }),
      ),
    );
    expect(hash).not.toHaveBeenCalled();
    expect(userCodeRepository.resetPassword).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
    hash.mockRestore();
  });

  it("rejects a code used up by a concurrent request with 422 and sends nothing", async () => {
    const { service, userCodeRepository, emailService } = setup();
    userCodeRepository.resetPassword.mockResolvedValue(null);

    expectInvalidResetCode(
      await captureError(
        service.resetPassword({ code: "ABCDEFGH", newPassword: "Nova@Senha1" }),
      ),
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
