import { describe, it, expect, vi } from "vitest";
import UserService from "../UserService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { expectCustomError } from "@/utils/tests.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const CREATED_AT = new Date("2026-01-15T10:30:00.000Z");

// Shape the repository select produces, plus a passwordHash that the select
// can no longer return: it is a sentry here, and the DTO must drop it.
function aStudentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    fullName: "Maria Silva",
    email: "maria@aluno.ufal.br",
    passwordHash: "super-secret-hash-that-must-never-leak",
    userType: "STUDENT",
    isManager: false,
    createdAt: CREATED_AT,
    student: {
      registrationCode: "20240012345",
      course: "Ciência da Computação",
    },
    teacher: null,
    ...overrides,
  };
}

function aTeacherRow(overrides: Record<string, unknown> = {}) {
  return aStudentRow({
    userType: "TEACHER",
    fullName: "Ricardo Almeida",
    email: "ricardo.almeida@ufal.br",
    student: null,
    teacher: {
      registrationCode: "1234567",
      course: null,
      cndb: "CNDB-9988",
    },
    ...overrides,
  });
}

function mockRepository(row: unknown) {
  return {
    findProfileById: vi.fn().mockResolvedValue(row),
  } as unknown as IUserRepository;
}

describe("UserService.getProfile", () => {
  it("builds the STUDENT profile and drops every internal field", async () => {
    const service = new UserService({
      userRepository: mockRepository(aStudentRow()),
    });

    const profile = await service.getProfile(USER_ID);

    expect(profile).toEqual({
      id: USER_ID,
      fullName: "Maria Silva",
      email: "maria@aluno.ufal.br",
      userType: "STUDENT",
      isManager: false,
      registrationCode: "20240012345",
      course: "Ciência da Computação",
      cndb: null,
      createdAt: CREATED_AT,
    });
    expect(Object.keys(profile)).not.toContain("passwordHash");
  });

  it("builds the TEACHER profile and drops every internal field", async () => {
    const service = new UserService({
      userRepository: mockRepository(aTeacherRow()),
    });

    const profile = await service.getProfile(USER_ID);

    expect(profile).toEqual({
      id: USER_ID,
      fullName: "Ricardo Almeida",
      email: "ricardo.almeida@ufal.br",
      userType: "TEACHER",
      isManager: false,
      registrationCode: "1234567",
      course: null,
      cndb: "CNDB-9988",
      createdAt: CREATED_AT,
    });
    expect(Object.keys(profile)).not.toContain("passwordHash");
  });

  it("asks the repository for the id it was given, and no other", async () => {
    const repository = mockRepository(aStudentRow());
    const service = new UserService({ userRepository: repository });

    await service.getProfile(USER_ID);

    expect(repository.findProfileById).toHaveBeenCalledExactlyOnceWith(USER_ID);
  });

  it("fails with 404 when the user does not exist", async () => {
    const service = new UserService({ userRepository: mockRepository(null) });

    await expectCustomError(
      service.getProfile(USER_ID),
      404,
      "User not found.",
    );
  });

  it("fails with 500 when the user has no academic profile row", async () => {
    const service = new UserService({
      userRepository: mockRepository(aStudentRow({ student: null })),
    });

    await expectCustomError(
      service.getProfile(USER_ID),
      500,
      "Profile data is inconsistent.",
    );
  });
});
