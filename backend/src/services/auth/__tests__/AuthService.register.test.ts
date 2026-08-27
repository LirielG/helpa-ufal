import { describe, it, expect, vi } from "vitest";
import AuthService from "../AuthService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { User } from "@prisma/client";
import { expectHttpError } from "@/utils/tests.js";
import { signJwt } from "@/utils/jwt.js";

// O register NÃO deve mais emitir JWT. Mockamos o módulo para provar que
// signJwt não é chamado neste fluxo (o login, em outro arquivo, usa o real).
vi.mock("@/utils/jwt.js", () => ({ signJwt: vi.fn(() => "token-mockado") }));

const STUDENT_INPUT: RegisterInput = {
  userType: "STUDENT",
  fullName: "Estudante de Teste",
  email: "estudante@ufal.br",
  password: "Senha@123",
  course: "Ciência da Computação",
  registrationCode: "20260001",
};

const TEACHER_INPUT: RegisterInput = {
  userType: "TEACHER",
  fullName: "Docente de Teste",
  email: "docente@ufal.br",
  password: "Senha@123",
  registrationCode: "20260002",
  cndb: "CNDB-001",
};

function aUser(overrides: Partial<User> = {}): User {
  return {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    fullName: "Estudante de Teste",
    email: "estudante@ufal.br",
    passwordHash: "$2a$12$hashbcryptdobanco",
    userType: "STUDENT",
    isManager: false,
    createdAt: new Date("2026-08-26T21:00:00.000Z"),
    updatedAt: new Date("2026-08-26T21:00:00.000Z"),
    ...overrides,
  };
}

function mockRepository(overrides: Partial<IUserRepository> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    createWithSubtype: vi.fn().mockResolvedValue(aUser()),
    ...overrides,
  } as unknown as IUserRepository;
}

describe("AuthService.register", () => {
  // ---------- Contrato pós-refatoração: cadastro NÃO autentica ----------

  it.each([STUDENT_INPUT, TEACHER_INPUT])(
    "creates the account and returns only the UserResponse ($userType)",
    async (input) => {
      const user = aUser({
        fullName: input.fullName,
        email: input.email,
        userType: input.userType,
      });
      const userRepository = mockRepository({
        createWithSubtype: vi.fn().mockResolvedValue(user),
      });
      const service = new AuthService({ userRepository });

      const result = await service.register(input);

      // Retorno "achatado": o resultado É o usuário — sem envelope { token, user }
      expect(result).toEqual({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        isManager: user.isManager,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result).not.toHaveProperty("token");
      expect(result).not.toHaveProperty("passwordHash");
    },
  );

  it("does not sign any JWT during registration", async () => {
    // Guarda da decisão da refatoração: emissão de token é exclusiva do login.
    const userRepository = mockRepository();
    const service = new AuthService({ userRepository });

    await service.register(STUDENT_INPUT);

    expect(signJwt).not.toHaveBeenCalled();
  });

  it("persists a bcrypt hash, never the raw password", async () => {
    const userRepository = mockRepository();
    const service = new AuthService({ userRepository });

    await service.register(STUDENT_INPUT);

    expect(userRepository.createWithSubtype).toHaveBeenCalledWith(
      expect.objectContaining({
        email: STUDENT_INPUT.email,
        userType: "STUDENT",
        registrationCode: STUDENT_INPUT.registrationCode,
        passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      }),
    );
    const persisted = vi.mocked(userRepository.createWithSubtype).mock
      .calls[0][0];
    expect(persisted.passwordHash).not.toBe(STUDENT_INPUT.password);
  });

  // ---------- Regras de negócio ----------

  it("throws 409 when the email is already in use", async () => {
    const userRepository = mockRepository({
      findByEmail: vi.fn().mockResolvedValue(aUser()),
    });
    const service = new AuthService({ userRepository });

    await expectHttpError(
      service.register(STUDENT_INPUT),
      409,
      "Email already in use.",
    );
    expect(userRepository.createWithSubtype).not.toHaveBeenCalled();
  });

  it("propagates repository failures", async () => {
    const userRepository = mockRepository({
      createWithSubtype: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });
    const service = new AuthService({ userRepository });

    await expect(service.register(STUDENT_INPUT)).rejects.toThrow(
      "database unavailable",
    );
  });
});