import { describe, it, expect, vi } from "vitest";
import bcryptjs from "bcryptjs";
import UserService from "../UserService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { expectCustomError } from "@/utils/tests.js";

/**
 * Spec for issue #95 (service layer of PATCH /users/me).
 * Contract: docs/bruno/User/Update user's profile.yml.
 *
 * Names this suite pins down for #59:
 *   IUserService.updateProfile(userId, input): Promise<UserProfileResponse>
 *     input = { fullName?, course?: string | null, currentPassword?, newPassword? }
 *     (already validated by Zod; who may send `course` is decided by the schema)
 *   IUserRepository.findById(id)
 *     -> the same row as findProfileById PLUS passwordHash, or null. Internal
 *        use only: findProfileById keeps not loading the hash.
 *   IUserRepository.updateProfile(id, data)
 *     data = { fullName?, course?, passwordHash? }, written in ONE call
 *     (one transaction; bumping tokenVersion when passwordHash is present is
 *     the repository's business and is covered by the integration suite).
 *     Returns the same row shape as findProfileById.
 *
 * Real bcrypt (cost 4) is used on purpose: the tests check what the hash IS,
 * not which bcrypt function the service happened to call.
 */

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const CREATED_AT = new Date("2026-01-15T10:30:00.000Z");
const CURRENT_PASSWORD = "Senha@123";
const NEW_PASSWORD = "Nova@1234";
const STORED_HASH = bcryptjs.hashSync(CURRENT_PASSWORD, 4);

function aStudentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    fullName: "Maria Silva",
    email: "maria@aluno.ufal.br",
    passwordHash: STORED_HASH,
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
      course: "Engenharia de Software",
      cndb: "CNDB-9988",
    },
    ...overrides,
  });
}

function setup(row: unknown, updatedRow: unknown = row) {
  const findById = vi.fn().mockResolvedValue(row);
  const update = vi.fn().mockResolvedValue(updatedRow);
  const repository = {
    findById,
    updateProfile: update,
  } as unknown as IUserRepository;

  return {
    service: new UserService({ userRepository: repository }),
    findById,
    update,
  };
}

describe("UserService.updateProfile", () => {
  describe("user lookup", () => {
    it("loads the user by the id it was given, and no other", async () => {
      const { service, findById } = setup(aStudentRow());

      await service.updateProfile(USER_ID, { fullName: "Maria" });

      expect(findById).toHaveBeenCalledExactlyOnceWith(USER_ID);
    });

    it("fails with 404 when the user does not exist, without writing", async () => {
      const { service, update } = setup(null);

      await expectCustomError(
        service.updateProfile(USER_ID, { fullName: "Maria" }),
        404,
        "User not found.",
      );
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("personal data", () => {
    it("sends only fullName to the repository, leaving the password alone", async () => {
      const { service, update } = setup(aStudentRow());

      await service.updateProfile(USER_ID, { fullName: "Maria Silva Souza" });

      expect(update).toHaveBeenCalledExactlyOnceWith(USER_ID, {
        fullName: "Maria Silva Souza",
      });
    });

    it("passes a teacher's course to the repository", async () => {
      const { service, update } = setup(aTeacherRow());

      await service.updateProfile(USER_ID, { course: "Engenharia de Computação" });

      expect(update).toHaveBeenCalledExactlyOnceWith(USER_ID, {
        course: "Engenharia de Computação",
      });
    });

    it("passes course: null through as null (it clears the course)", async () => {
      const { service, update } = setup(aTeacherRow());

      await service.updateProfile(USER_ID, { course: null });

      expect(update).toHaveBeenCalledExactlyOnceWith(USER_ID, { course: null });
    });
  });

  describe("password change", () => {
    it("rejects an incorrect currentPassword with 403 and writes nothing", async () => {
      const { service, update } = setup(aStudentRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          currentPassword: "Wrong@1234",
          newPassword: NEW_PASSWORD,
        }),
        403,
        "Current password is incorrect.",
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("writes nothing else when currentPassword is wrong, not even fullName or course", async () => {
      const { service, update } = setup(aTeacherRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          fullName: "Should Not Apply",
          course: null,
          currentPassword: "Wrong@1234",
          newPassword: NEW_PASSWORD,
        }),
        403,
        "Current password is incorrect.",
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("answers 403, not 422, when currentPassword is wrong and newPassword equals the stored password", async () => {
      // A caller who does not know the current password must not be able to
      // learn that the "new" one matches it.
      const { service, update } = setup(aStudentRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          currentPassword: "Wrong@1234",
          newPassword: CURRENT_PASSWORD,
        }),
        403,
        "Current password is incorrect.",
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("rejects a newPassword equal to the current one with 422 and writes nothing", async () => {
      const { service, update } = setup(aStudentRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          currentPassword: CURRENT_PASSWORD,
          newPassword: CURRENT_PASSWORD,
        }),
        422,
        "New password must be different from the current password.",
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("persists a hash of the new password, never the plain text", async () => {
      const { service, update } = setup(aStudentRow());

      await service.updateProfile(USER_ID, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      expect(update).toHaveBeenCalledOnce();
      const [id, data] = update.mock.calls[0];
      expect(id).toBe(USER_ID);
      expect(data.passwordHash).not.toBe(NEW_PASSWORD);
      expect(await bcryptjs.compare(NEW_PASSWORD, data.passwordHash)).toBe(true);
      expect(await bcryptjs.compare(CURRENT_PASSWORD, data.passwordHash)).toBe(false);
    });

    it("never hands either plain password to the repository", async () => {
      const { service, update } = setup(aStudentRow());

      await service.updateProfile(USER_ID, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      const [, data] = update.mock.calls[0];
      expect(data).not.toHaveProperty("newPassword");
      expect(data).not.toHaveProperty("currentPassword");
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain(NEW_PASSWORD);
      expect(serialized).not.toContain(CURRENT_PASSWORD);
    });

    it("writes fullName, course and the new hash in a single repository call", async () => {
      const { service, update } = setup(aTeacherRow());

      await service.updateProfile(USER_ID, {
        fullName: "Ricardo Editado",
        course: null,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      expect(update).toHaveBeenCalledOnce();
      const [, data] = update.mock.calls[0];
      expect(Object.keys(data).sort()).toEqual(
        ["course", "fullName", "passwordHash"].sort(),
      );
      expect(data.fullName).toBe("Ricardo Editado");
      expect(data.course).toBeNull();
    });
  });

  describe("response", () => {
    it("returns the STUDENT profile built from the updated row, without passwordHash", async () => {
      const { service } = setup(
        aStudentRow(),
        aStudentRow({ fullName: "Maria Silva Souza" }),
      );

      const profile = await service.updateProfile(USER_ID, {
        fullName: "Maria Silva Souza",
      });

      expect(profile).toEqual({
        id: USER_ID,
        fullName: "Maria Silva Souza",
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

    it("returns the TEACHER profile with a cleared course, without passwordHash", async () => {
      const cleared = aTeacherRow();
      cleared.teacher = { ...(cleared.teacher as object), course: null } as never;
      const { service } = setup(aTeacherRow(), cleared);

      const profile = await service.updateProfile(USER_ID, { course: null });

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

    it("fails with 500 when the updated user has no academic profile row", async () => {
      const { service } = setup(aStudentRow(), aStudentRow({ student: null }));

      await expectCustomError(
        service.updateProfile(USER_ID, { fullName: "Maria" }),
        500,
        "Profile data is inconsistent.",
      );
    });
  });
});
