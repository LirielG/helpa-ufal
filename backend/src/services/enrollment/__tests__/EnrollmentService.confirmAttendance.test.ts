import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { expectCustomError } from "@/utils/tests.js";

const AUTHOR_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const MANAGER_ID = "1f0c1b6a-8f4a-4a6e-9d2f-0c0f7a3d5b11";
const VOLUNTEER_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ACTIVITY_ID = "f26559ac-d672-4252-a9a4-d6fe6583d8ec";
const ENROLLMENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

const WORKLOAD_HOURS = 20;
const UPDATED_AT = new Date("2026-08-30T18:45:00.000Z");

function anActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    authorId: AUTHOR_ID,
    status: "COMPLETED",
    details: { workloadHours: WORKLOAD_HOURS },
    ...overrides,
  };
}

function anEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    userId: VOLUNTEER_ID,
    activityId: ACTIVITY_ID,
    status: "APPROVED",
    attendanceConfirmed: null,
    confirmedWorkloadHours: 0,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function mockRepositories(
  overrides: {
    activity?: Record<string, unknown>;
    enrollment?: Record<string, unknown>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(anActivity()),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const enrollmentRepository = {
    findByIdAndActivity: vi.fn().mockResolvedValue(anEnrollment()),
    // The repository echoes back the persisted pair, so the assertions below
    // check what the service ASKED it to write, not a value it invented.
    confirmAttendance: vi
      .fn()
      .mockImplementation(
        async (
          _activityId: string,
          _enrollmentId: string,
          attendanceConfirmed: boolean,
          confirmedWorkloadHours: number,
        ) =>
          anEnrollment({
            attendanceConfirmed,
            confirmedWorkloadHours,
            updatedAt: UPDATED_AT,
          }),
      ),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, enrollmentRepository };
}

function aService(overrides: Parameters<typeof mockRepositories>[0] = {}): {
  service: EnrollmentService;
  activityRepository: IActivityRepository;
  enrollmentRepository: IEnrollmentRepository;
} {
  const { activityRepository, enrollmentRepository } =
    mockRepositories(overrides);

  return {
    service: new EnrollmentService({
      activityRepository,
      enrollmentRepository,
    }),
    activityRepository,
    enrollmentRepository,
  };
}

describe("EnrollmentService.confirmAttendance", () => {
  // ---------- Happy path and DTO ----------

  it("writes the pair (true, hours) for the activity author and returns the attendance DTO", async () => {
    const { service, enrollmentRepository } = aService();

    const result = await service.confirmAttendance(
      AUTHOR_ID,
      ACTIVITY_ID,
      ENROLLMENT_ID,
      { attended: true, workloadHours: 4 },
    );

    expect(enrollmentRepository.confirmAttendance).toHaveBeenCalledWith(
      ACTIVITY_ID,
      ENROLLMENT_ID,
      true,
      4,
    );
    expect(result).toEqual({
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
      updatedAt: UPDATED_AT,
    });
  });

  it("looks the enrollment up scoped to the activity — the link is never assumed", async () => {
    const { service, enrollmentRepository } = aService();

    await service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
      attended: true,
      workloadHours: 4,
    });

    expect(enrollmentRepository.findByIdAndActivity).toHaveBeenCalledWith(
      ENROLLMENT_ID,
      ACTIVITY_ID,
    );
  });

  // ---------- Absence forces zero ----------

  it("attended=false writes (false, 0), ignoring nothing and inventing nothing", async () => {
    const { service, enrollmentRepository } = aService();

    const result = await service.confirmAttendance(
      AUTHOR_ID,
      ACTIVITY_ID,
      ENROLLMENT_ID,
      { attended: false },
    );

    expect(enrollmentRepository.confirmAttendance).toHaveBeenCalledWith(
      ACTIVITY_ID,
      ENROLLMENT_ID,
      false,
      0,
    );
    expect(result.confirmedWorkloadHours).toBe(0);
  });

  it("rejects workloadHours sent together with attended=false", async () => {
    const { service, enrollmentRepository } = aService();

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: false,
        workloadHours: 4,
      }),
      422,
      "workloadHours must be omitted when attended is false.",
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  // ---------- Hours range ----------

  it("rejects attended=true without workloadHours — (true, 0) is not a valid state", async () => {
    const { service, enrollmentRepository } = aService();

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
      }),
      422,
      "workloadHours is required when attended is true.",
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  it.each([0, -1, 4.5, WORKLOAD_HOURS + 1])(
    "rejects %s hours and writes nothing",
    async (workloadHours) => {
      const { service, enrollmentRepository } = aService();

      await expectCustomError(
        service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
          attended: true,
          workloadHours,
        }),
        422,
        "workloadHours must be an integer between 1 and the activity's workload hours.",
      );
      expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
    },
  );

  it.each([1, WORKLOAD_HOURS])(
    "accepts %i hours — both limits belong to the interval",
    async (workloadHours) => {
      const { service, enrollmentRepository } = aService();

      const result = await service.confirmAttendance(
        AUTHOR_ID,
        ACTIVITY_ID,
        ENROLLMENT_ID,
        { attended: true, workloadHours },
      );

      expect(enrollmentRepository.confirmAttendance).toHaveBeenCalledWith(
        ACTIVITY_ID,
        ENROLLMENT_ID,
        true,
        workloadHours,
      );
      expect(result.confirmedWorkloadHours).toBe(workloadHours);
    },
  );

  it("the ceiling comes from the activity being homologated, not from a constant", async () => {
    const { service, enrollmentRepository } = aService({
      activity: {
        findById: vi
          .fn()
          .mockResolvedValue(anActivity({ details: { workloadHours: 3 } })),
      },
    });

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
        workloadHours: 4,
      }),
      422,
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  // ---------- Activity status ----------

  it.each(["OPEN", "IN_PROGRESS", "CANCELLED"] as const)(
    "rejects homologation on a %s activity",
    async (status) => {
      const { service, enrollmentRepository } = aService({
        activity: {
          findById: vi.fn().mockResolvedValue(anActivity({ status })),
        },
      });

      await expectCustomError(
        service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
          attended: true,
          workloadHours: 4,
        }),
        409,
        "Attendance can only be confirmed for completed activities.",
      );
      expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
    },
  );

  // ---------- Enrollment status ----------

  it.each(["CANCELLED", "PENDING", "REJECTED"] as const)(
    "rejects a %s enrollment",
    async (status) => {
      const { service, enrollmentRepository } = aService({
        enrollment: {
          findByIdAndActivity: vi
            .fn()
            .mockResolvedValue(anEnrollment({ status })),
        },
      });

      await expectCustomError(
        service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
          attended: true,
          workloadHours: 4,
        }),
        409,
        "Only approved enrollments can have attendance confirmed.",
      );
      expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
    },
  );

  // ---------- Authorization ----------

  it("allows a manager who is not the author", async () => {
    const { service, enrollmentRepository } = aService({
      activity: {
        findUserById: vi.fn().mockResolvedValue({ isManager: true }),
      },
    });

    await service.confirmAttendance(MANAGER_ID, ACTIVITY_ID, ENROLLMENT_ID, {
      attended: true,
      workloadHours: 4,
    });

    expect(enrollmentRepository.confirmAttendance).toHaveBeenCalled();
  });

  it("forbids any other authenticated user", async () => {
    const { service, enrollmentRepository } = aService();

    await expectCustomError(
      service.confirmAttendance(
        "6e8bc430-9c3a-41d5-a0e6-9b1c0b2b6a01",
        ACTIVITY_ID,
        ENROLLMENT_ID,
        { attended: true, workloadHours: 4 },
      ),
      403,
      "Only the activity creator or a manager can confirm attendance.",
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  it("forbids the enrolled volunteer from homologating themselves", async () => {
    const { service, enrollmentRepository } = aService();

    await expectCustomError(
      service.confirmAttendance(VOLUNTEER_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
        workloadHours: 4,
      }),
      403,
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  it("rejects a token whose user no longer exists, before anything else", async () => {
    const { service, activityRepository, enrollmentRepository } = aService({
      activity: { findUserById: vi.fn().mockResolvedValue(null) },
    });

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
        workloadHours: 4,
      }),
      401,
      "User account not found or inactive.",
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  // ---------- Free correction ----------

  it("overwrites an existing homologation without any extra condition", async () => {
    const { service, enrollmentRepository } = aService({
      enrollment: {
        findByIdAndActivity: vi.fn().mockResolvedValue(
          anEnrollment({
            attendanceConfirmed: true,
            confirmedWorkloadHours: 4,
          }),
        ),
      },
    });

    const result = await service.confirmAttendance(
      AUTHOR_ID,
      ACTIVITY_ID,
      ENROLLMENT_ID,
      { attended: true, workloadHours: 6 },
    );

    expect(enrollmentRepository.confirmAttendance).toHaveBeenCalledWith(
      ACTIVITY_ID,
      ENROLLMENT_ID,
      true,
      6,
    );
    expect(result.confirmedWorkloadHours).toBe(6);
  });

  it("turns a registered presence into an absence, zeroing the hours", async () => {
    const { service, enrollmentRepository } = aService({
      enrollment: {
        findByIdAndActivity: vi.fn().mockResolvedValue(
          anEnrollment({
            attendanceConfirmed: true,
            confirmedWorkloadHours: 4,
          }),
        ),
      },
    });

    const result = await service.confirmAttendance(
      AUTHOR_ID,
      ACTIVITY_ID,
      ENROLLMENT_ID,
      { attended: false },
    );

    expect(enrollmentRepository.confirmAttendance).toHaveBeenCalledWith(
      ACTIVITY_ID,
      ENROLLMENT_ID,
      false,
      0,
    );
    expect(result).toEqual({
      attendanceConfirmed: false,
      confirmedWorkloadHours: 0,
      updatedAt: UPDATED_AT,
    });
  });

  // ---------- Existence and validation order ----------

  it("returns 404 for an activity that does not exist", async () => {
    const { service, enrollmentRepository } = aService({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
        workloadHours: 4,
      }),
      404,
      "Activity not found.",
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  it("returns 404 when the enrollment does not belong to the activity", async () => {
    const { service, enrollmentRepository } = aService({
      enrollment: { findByIdAndActivity: vi.fn().mockResolvedValue(null) },
    });

    await expectCustomError(
      service.confirmAttendance(AUTHOR_ID, ACTIVITY_ID, ENROLLMENT_ID, {
        attended: true,
        workloadHours: 4,
      }),
      404,
      "Enrollment not found.",
    );
    expect(enrollmentRepository.confirmAttendance).not.toHaveBeenCalled();
  });

  it("checks existence (404) before authorization (403)", async () => {
    const { service } = aService({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expectCustomError(
      service.confirmAttendance(
        "6e8bc430-9c3a-41d5-a0e6-9b1c0b2b6a01",
        ACTIVITY_ID,
        ENROLLMENT_ID,
        { attended: true, workloadHours: 4 },
      ),
      404,
    );
  });

  it("checks authorization (403) before the business rules (409)", async () => {
    const { service } = aService({
      activity: {
        findById: vi.fn().mockResolvedValue(anActivity({ status: "OPEN" })),
      },
    });

    await expectCustomError(
      service.confirmAttendance(
        "6e8bc430-9c3a-41d5-a0e6-9b1c0b2b6a01",
        ACTIVITY_ID,
        ENROLLMENT_ID,
        { attended: true, workloadHours: 4 },
      ),
      403,
    );
  });
});
