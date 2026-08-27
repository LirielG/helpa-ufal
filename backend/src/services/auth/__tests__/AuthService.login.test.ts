import { describe, it, expect, vi } from "vitest";
import bcryptjs from "bcryptjs";
import AuthService from "../AuthService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { Login } from "@/schemas/auth/AuthSchemas.js";
import type { User } from "@prisma/client";
import { expectHttpError } from "@/utils/tests.js";
import { verifyJwt } from "@/utils/jwt.js";

// REGRESSÃO: o login não é tocado pela refatoração. Estes testes passam hoje
// (caracterização) e devem continuar verdes. O projeto "unit" injeta
// JWT_SECRET/JWT_EXPIRES_IN dummy no ambiente, então o round-trip JWT é real.

const PASSWORD = "Senha@123";
const PASSWORD_HASH = bcryptjs.hashSync(PASSWORD, 4); // custo baixo: velocidade

const LOGIN_INPUT: Login = { email: "estudante@ufal.br", password: PASSWORD };

function aUser(overrides: Partial<User> = {}): User {
  return {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    fullName: "Estudante de Teste",
    email: "estudante@ufal.br",
    passwordHash: PASSWORD_HASH,
    userType: "STUDENT",
    isManager: false,
    createdAt: new Date("2026-08-26T21:00:00.000Z"),
    updatedAt: new Date("2026-08-26T21:00:00.000Z"),
    ...overrides,
  };
}

function mockRepository(overrides: Partial<IUserRepository> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(aUser()),
    createWithSubtype: vi.fn(),
    ...overrides,
  } as unknown as IUserRepository;
}

describe("AuthService.login", () => {
  it("returns the { token, user } envelope with a valid JWT", async () => {
    const userRepository = mockRepository();
    const service = new AuthService({ userRepository });

    const result = await service.login(LOGIN_INPUT);

    // Envelope do login (diferente do register, que agora é "achatado")
    expect(result.user).toEqual({
      id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      fullName: "Estudante de Teste",
      email: "estudante@ufal.br",
      userType: "STUDENT",
      isManager: false,
      createdAt: new Date("2026-08-26T21:00:00.000Z"),
      updatedAt: new Date("2026-08-26T21:00:00.000Z"),
    });
    expect(result.user).not.toHaveProperty("passwordHash");

    const payload = verifyJwt(result.token);
    expect(payload).toMatchObject({
      id: result.user.id,
      userType: "STUDENT",
      isManager: false,
    });
  });

  it("throws 401 when the email does not exist", async () => {
    const userRepository = mockRepository({
      findByEmail: vi.fn().mockResolvedValue(null),
    });
    const service = new AuthService({ userRepository });

    await expectHttpError(
      service.login(LOGIN_INPUT),
      401,
      "Invalid credentials.",
    );
  });

  it("throws 401 for a wrong password (same message — no user enumeration)", async () => {
    const userRepository = mockRepository();
    const service = new AuthService({ userRepository });

    await expectHttpError(
      service.login({ ...LOGIN_INPUT, password: "SenhaErrada@1" }),
      401,
      "Invalid credentials.",
    );
  });
});