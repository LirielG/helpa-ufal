import { describe, it, expect, vi } from "vitest";
import bcryptjs from "bcryptjs";
import UserService from "../UserService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IEmailService } from "@/services/email/IEmailService.js";
import { expectCustomError } from "@/utils/tests.js";

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

function setup(
  row: unknown,
  updatedRow: unknown = row,
  totalWorkloadHours = 0,
) {
  const findById = vi.fn().mockResolvedValue(row);
  const update = vi.fn().mockResolvedValue(updatedRow);
  const sumHours = vi.fn().mockResolvedValue(totalWorkloadHours);
  const repository = {
    findById,
    updateProfile: update,
  } as unknown as IUserRepository;
  const enrollmentRepository = {
    sumConfirmedHoursByUserId: sumHours,
  } as unknown as IEnrollmentRepository;
  // Always injected: without it the service would build a real EmailService.
  const send = vi.fn().mockResolvedValue(undefined);
  const emailService = { send } as unknown as IEmailService;

  return {
    service: new UserService({
      userRepository: repository,
      enrollmentRepository,
      emailService,
    }),
    findById,
    update,
    sumHours,
    send,
  };
}

describe("UserService.updateProfile", () => {
  describe("user lookup", () => {
    it("does not load the password when updating only personal data", async () => {
      const { service, findById } = setup(aStudentRow());

      await service.updateProfile(USER_ID, { fullName: "Maria" });

      expect(findById).not.toHaveBeenCalled();
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

      await service.updateProfile(USER_ID, {
        course: "Engenharia de Computação",
      });

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
      expect(await bcryptjs.compare(NEW_PASSWORD, data.passwordHash)).toBe(
        true,
      );
      expect(await bcryptjs.compare(CURRENT_PASSWORD, data.passwordHash)).toBe(
        false,
      );
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

  // ---------- Password changed e-mail (issue #432) ----------

  describe("password changed e-mail", () => {
    const passwordChange = {
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    };

    it("sends passwordChanged to the account's e-mail with the first name only", async () => {
      const { service, send } = setup(aStudentRow());

      await service.updateProfile(USER_ID, passwordChange);

      // Exactly these vars: no password, plain or hashed, ever reaches the e-mail.
      expect(send).toHaveBeenCalledExactlyOnceWith(
        "maria@aluno.ufal.br",
        "passwordChanged",
        { firstName: "Maria" },
      );
    });

    it("uses the teacher's own e-mail and first name", async () => {
      const { service, send } = setup(aTeacherRow());

      await service.updateProfile(USER_ID, passwordChange);

      expect(send).toHaveBeenCalledExactlyOnceWith(
        "ricardo.almeida@ufal.br",
        "passwordChanged",
        { firstName: "Ricardo" },
      );
    });

    it.each([
      { fullName: "Maria", firstName: "Maria" },
      { fullName: "Maria Silva Souza", firstName: "Maria" },
      { fullName: "  Maria   Silva ", firstName: "Maria" },
    ])("greets %j as $firstName", async ({ fullName, firstName }) => {
      const { service, send } = setup(aStudentRow({ fullName }));

      await service.updateProfile(USER_ID, passwordChange);

      expect(send).toHaveBeenCalledWith(expect.any(String), "passwordChanged", {
        firstName,
      });
    });

    it("greets by the name saved in the same request, not the old one", async () => {
      const { service, send } = setup(
        aStudentRow({ fullName: "Maria Silva" }),
        aStudentRow({ fullName: "Joana Souza" }),
      );

      await service.updateProfile(USER_ID, {
        ...passwordChange,
        fullName: "Joana Souza",
      });

      expect(send).toHaveBeenCalledWith(
        "maria@aluno.ufal.br",
        "passwordChanged",
        { firstName: "Joana" },
      );
    });

    it.each([
      { label: "only fullName", input: { fullName: "Maria Nova" } },
      { label: "only course", input: { course: "Engenharia" } },
      {
        label: "fullName and course",
        input: { fullName: "Maria", course: null },
      },
    ])(
      "does not send anything when the request changes $label",
      async ({ input }) => {
        const { service, send } = setup(aTeacherRow());

        await service.updateProfile(USER_ID, input);

        expect(send).not.toHaveBeenCalled();
      },
    );

    it("does not send anything when currentPassword is wrong (403)", async () => {
      const { service, send } = setup(aStudentRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          currentPassword: "Wrong@1234",
          newPassword: NEW_PASSWORD,
        }),
        403,
        "Current password is incorrect.",
      );

      expect(send).not.toHaveBeenCalled();
    });

    it("does not send anything when newPassword equals the current one (422)", async () => {
      const { service, send } = setup(aStudentRow());

      await expectCustomError(
        service.updateProfile(USER_ID, {
          currentPassword: CURRENT_PASSWORD,
          newPassword: CURRENT_PASSWORD,
        }),
        422,
        "New password must be different from the current password.",
      );

      expect(send).not.toHaveBeenCalled();
    });

    it("sends only after the repository finished the update", async () => {
      const { service, update, send } = setup(aStudentRow());

      await service.updateProfile(USER_ID, passwordChange);

      expect(update.mock.invocationCallOrder[0]).toBeLessThan(
        send.mock.invocationCallOrder[0],
      );
    });

    it("does not send when the repository update fails, since nothing changed", async () => {
      const { service, update, send } = setup(aStudentRow());
      update.mockRejectedValue(new Error("db down"));

      await expect(
        service.updateProfile(USER_ID, passwordChange),
      ).rejects.toThrow("db down");

      expect(send).not.toHaveBeenCalled();
    });

    it("still returns the profile when the e-mail fails, and logs the failure", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      try {
        const { service, send } = setup(aStudentRow(), aStudentRow(), 12);
        send.mockRejectedValue(new Error("smtp down"));

        const profile = await service.updateProfile(USER_ID, passwordChange);

        expect(profile).toMatchObject({ id: USER_ID, totalWorkloadHours: 12 });
        // The rejection is handled on a later microtask than the return.
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
        // The prefix is the one the issue prescribes, so it can be searched in logs.
        expect(consoleError.mock.calls[0][0]).toBe(
          "[UserService] Password changed email failed:",
        );
        expect(String(consoleError.mock.calls[0])).toContain("smtp down");
        // The recipient's address stays out of the logs.
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
          "maria@aluno.ufal.br",
        );
      } finally {
        consoleError.mockRestore();
      }
    });

    it("does not wait for the e-mail: a send that never settles does not hold the response", async () => {
      const { service, send } = setup(aStudentRow());
      send.mockReturnValue(new Promise<void>(() => undefined));

      const profile = await service.updateProfile(USER_ID, passwordChange);

      expect(profile.id).toBe(USER_ID);
      expect(send).toHaveBeenCalledOnce();
    });

    it("still tells the owner when reading the workload hours fails after the write", async () => {
      const { service, sumHours, send } = setup(aStudentRow());
      sumHours.mockRejectedValue(new Error("db down"));

      await expect(
        service.updateProfile(USER_ID, passwordChange),
      ).rejects.toThrow("db down");

      expect(send).toHaveBeenCalledOnce();
    });

    it("still tells the owner when the updated profile cannot be built (500)", async () => {
      const { service, send } = setup(
        aStudentRow(),
        aStudentRow({ student: null }),
      );

      await expectCustomError(
        service.updateProfile(USER_ID, passwordChange),
        500,
        "Profile data is inconsistent.",
      );

      expect(send).toHaveBeenCalledOnce();
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
        totalWorkloadHours: 0,
      });
      expect(Object.keys(profile)).not.toContain("passwordHash");
    });

    it("returns the TEACHER profile with a cleared course, without passwordHash", async () => {
      const cleared = aTeacherRow();
      cleared.teacher = {
        ...(cleared.teacher as unknown as object),
        course: null,
      } as never;
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
        totalWorkloadHours: 0,
      });
      expect(Object.keys(profile)).not.toContain("passwordHash");
    });

    it("returns the owner's homologated hours as totalWorkloadHours", async () => {
      const { service, sumHours } = setup(aStudentRow(), aStudentRow(), 12);

      const profile = await service.updateProfile(USER_ID, {
        fullName: "Maria",
      });

      expect(profile.totalWorkloadHours).toBe(12);
      expect(sumHours).toHaveBeenCalledExactlyOnceWith(USER_ID);
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
