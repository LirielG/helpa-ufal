import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { expectHttpError } from "@/utils/tests.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ACTIVITY_ID = "f26559ac-d672-4252-a9a4-d6fe6583d8ec";

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
    enrollment?: Partial<IEnrollmentRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue({ id: ACTIVITY_ID, status: "OPEN", slots: 30 }),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    enroll: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    countApprovedByActivityId: vi.fn().mockResolvedValue(0),
    findActiveByUserId: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, enrollmentRepository };
}


describe("EnrollmentService.cancel", () => {
  // ---------- Happy path ----------

  it("cancels the enrollment and resolves with no content (contract: 204)", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories();
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expect(service.cancel(USER_ID, ACTIVITY_ID)).resolves.toBeUndefined();
    expect(enrollmentRepository.cancel).toHaveBeenCalledWith(USER_ID, ACTIVITY_ID);
  });

  // ---------- Authentication ----------

  it("throws 401 when the token's user no longer exists in the database", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: { findUserById: vi.fn().mockResolvedValue(null) },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(
      service.cancel(USER_ID, ACTIVITY_ID),
      401,
      "User account not found or inactive.",
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(enrollmentRepository.cancel).not.toHaveBeenCalled();
  });

  // ---------- Input validation ----------

  it("rejects a malformed activityId with a ValidationError", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories();
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expect(
      service.cancel(USER_ID, "not-a-uuid"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(enrollmentRepository.cancel).not.toHaveBeenCalled();
  });

  // ---------- Activity existence ----------

  it("throws 404 when the activity does not exist (or was soft-deleted)", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(service.cancel(USER_ID, ACTIVITY_ID), 404, "Activity not found.");
    expect(enrollmentRepository.cancel).not.toHaveBeenCalled();
  });

  // ---------- Repository rule (propagation) ----------

  it("propagates 404 when there is no cancelable enrollment for the pair", async () => {
    // Covers: never enrolled, already CANCELLED, and enrollment owned by
    // another user — the repository scopes by (userId, activityId) and the
    // contract deliberately makes these indistinguishable.
    const { activityRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        cancel: vi.fn().mockRejectedValue(new CustomError(404, "Enrollment not found.")),
      },
    });
    const service = new EnrollmentService({ activityRepository, enrollmentRepository });

    await expectHttpError(service.cancel(USER_ID, ACTIVITY_ID), 404, "Enrollment not found.");
  });
});