import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { expectHttpError } from "@/utils/tests.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ACTIVITY_ID = "f26559ac-d672-4252-a9a4-d6fe6583d8ec";
const ENROLLMENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

function anEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    userId: USER_ID,
    activityId: ACTIVITY_ID,
    status: "APPROVED",
    attendanceConfirmed: false,
    isModerator: false,
    enrolledAt: new Date("2026-08-22T21:00:00.000Z"),
    createdAt: new Date("2026-08-22T21:00:00.000Z"),
    updatedAt: new Date("2026-08-22T21:00:00.000Z"),
    ...overrides,
  };
}

function anActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    authorId: "author-1",
    title: "Atividade de Teste",
    type: "COURSE",
    campus: "ARAPIRACA",
    startDate: new Date("2026-08-29T09:00:00.000Z"),
    endDate: new Date("2026-09-05T18:00:00.000Z"),
    slots: 30,
    availableSlots: 5,
    status: "OPEN",
    details: null,
    ...overrides,
  };
}

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
    enrollment?: Partial<IEnrollmentRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(anActivity()),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    enroll: vi.fn().mockResolvedValue(anEnrollment()),
    cancel: vi.fn().mockResolvedValue(undefined),
    countApprovedByActivityId: vi.fn().mockResolvedValue(0),
    findActiveByUserId: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, enrollmentRepository };
}


describe("EnrollmentService.enroll", () => {
  // ---------- Authentication (contract: 401 before existence/business rules) ----------

  it("throws 401 when the token's user no longer exists in the database", async () => {
    // Ghost user: account removed, token still valid. Checked before anything
    // else, following the contract's validation order.
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: { findUserById: vi.fn().mockResolvedValue(null) },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(
      service.enroll(USER_ID, ACTIVITY_ID),
      401,
      "User account not found or inactive.",
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(enrollmentRepository.enroll).not.toHaveBeenCalled();
  });

  // ---------- Input validation ----------

  it("rejects a malformed activityId with a ValidationError", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories();
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expect(
      service.enroll(USER_ID, "not-a-uuid"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(enrollmentRepository.enroll).not.toHaveBeenCalled();
  });

  // ---------- Activity existence/state ----------

  it("throws 404 when the activity does not exist (or was soft-deleted)", async () => {
    // findById filters deletedAt, so null covers both cases of the contract.
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(service.enroll(USER_ID, ACTIVITY_ID), 404, "Activity not found.");
    expect(enrollmentRepository.enroll).not.toHaveBeenCalled();
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "throws 409 when the activity status is %s (not open for enrollment)",
    async (status) => {
      // CANCELLED here is the activity lifecycle status — distinct from soft
      // delete (deletedAt), which is 404 via the filtered findById.
      const { activityRepository, enrollmentRepository } = mockRepositories({
        activity: { findById: vi.fn().mockResolvedValue(anActivity({ status })) },
      });
      const service = new EnrollmentService({ activityRepository, enrollmentRepository });

      await expectHttpError(
        service.enroll(USER_ID, ACTIVITY_ID),
        409,
        "Activity is not open for enrollment.",
      );
      expect(enrollmentRepository.enroll).not.toHaveBeenCalled();
    },
  );

  // ---------- Happy path ----------

  it("creates an enrollment and returns the contract's 201 shape", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories();
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    const response = await service.enroll(USER_ID, ACTIVITY_ID);

    expect(response).toEqual({
      id: ENROLLMENT_ID,
      activityId: ACTIVITY_ID,
      userId: USER_ID,
      createdAt: new Date("2026-08-22T21:00:00.000Z"),
    });
  });


  it("keeps the original createdAt when the repository reactivates a canceled enrollment", async () => {
    // Contract decision: reactivation returns 201 with the record's original
    // createdAt, not the reactivation moment (that one lives in enrolledAt).
    const reactivated = anEnrollment({
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      enrolledAt: new Date("2026-08-22T21:00:00.000Z"),
    });
    const { activityRepository, enrollmentRepository } = mockRepositories({
      enrollment: { enroll: vi.fn().mockResolvedValue(reactivated) },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    const response = await service.enroll(USER_ID, ACTIVITY_ID);

    expect(response.id).toBe(ENROLLMENT_ID);
    expect(response.createdAt).toEqual(new Date("2026-06-01T10:00:00.000Z"));
  });

  // ---------- Repository business rules (propagation) ----------

  it("propagates 409 when the user is already enrolled", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        enroll: vi
          .fn()
          .mockRejectedValue(new CustomError(409, "User is already enrolled in this activity.")),
      },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(
      service.enroll(USER_ID, ACTIVITY_ID),
      409,
      "User is already enrolled in this activity.",
    );
  });

  it("propagates 409 when the activity has no available slots", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        enroll: vi
          .fn()
          .mockRejectedValue(new CustomError(409, "No available slots for this activity.")),
      },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(
      service.enroll(USER_ID, ACTIVITY_ID),
      409,
      "No available slots for this activity.",
    );
  });
});