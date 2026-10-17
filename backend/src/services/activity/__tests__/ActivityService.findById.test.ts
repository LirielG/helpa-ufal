import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import { expectCustomError } from "@/utils/tests.js";

const ACTIVITY_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const USER_ID = "a1b2c3d4-0000-4000-8000-000000000099";

const fakeActivity = {
  id: ACTIVITY_ID,
  authorId: USER_ID,
  title: "Oficina de Programação",
  type: "EXTENSION",
  campus: "MACEIO",
  startDate: new Date(),
  endDate: new Date(),
  slots: 40,
  availableSlots: 40,
  status: "OPEN",
  details: null,
};

function buildService(
  overrides: {
    activity?: Partial<IActivityRepository>;
    enrollment?: Partial<IEnrollmentRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(fakeActivity),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {} as IUserRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  const service = new ActivityService({
    activityRepository,
    userRepository,
    enrollmentRepository,
  });

  return { service, enrollmentRepository };
}

describe("ActivityService.findById", () => {
  it("throws 404 when the activity does not exist", async () => {
    const { service } = buildService({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expectCustomError(
      service.findById(ACTIVITY_ID),
      404,
      "Activity not found.",
    );
  });

  it("omits enrollmentStatus and skips the lookup without a userId", async () => {
    const { service, enrollmentRepository } = buildService();

    const result = await service.findById(ACTIVITY_ID);

    expect(result).not.toHaveProperty("enrollmentStatus");
    expect(enrollmentRepository.findByUserAndActivity).not.toHaveBeenCalled();
  });

  it("returns null when the user has never enrolled", async () => {
    const { service, enrollmentRepository } = buildService();

    const result = await service.findById(ACTIVITY_ID, USER_ID);

    expect(result).toHaveProperty("enrollmentStatus", null);
    expect(enrollmentRepository.findByUserAndActivity).toHaveBeenCalledWith(
      USER_ID,
      ACTIVITY_ID,
    );
  });

  it.each(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const)(
    "returns the enrollment status when it is %s",
    async (status) => {
      const { service } = buildService({
        enrollment: {
          findByUserAndActivity: vi.fn().mockResolvedValue({ status }),
        },
      });

      const result = await service.findById(ACTIVITY_ID, USER_ID);

      expect(result.enrollmentStatus).toBe(status);
    },
  );
});
