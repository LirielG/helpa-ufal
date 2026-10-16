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

function mockRepositories(overrides: {
  activity?: Partial<IActivityRepository>;
  user?: Partial<IUserRepository>;
  enrollment?: Partial<IEnrollmentRepository>;
} = {}) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(fakeActivity),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {
    findById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.user,
  } as unknown as IUserRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, userRepository, enrollmentRepository };
}

describe("ActivityService.findById", () => {

  it("retorna 404 quando a atividade não existe", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    await expectCustomError(service.findById(ACTIVITY_ID), 404, "Activity not found.");
  });

  it("sem userId: retorna atividade sem o campo enrollmentStatus", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    const result = await service.findById(ACTIVITY_ID);

    expect(result).not.toHaveProperty("enrollmentStatus");
    expect(enrollmentRepository.findByUserAndActivity).not.toHaveBeenCalled();
  });

  it("com userId sem inscrição: retorna enrollmentStatus null", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories({
      enrollment: { findByUserAndActivity: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    const result = await service.findById(ACTIVITY_ID, USER_ID);

    expect(result.enrollmentStatus).toBeNull();
    expect(enrollmentRepository.findByUserAndActivity).toHaveBeenCalledWith(USER_ID, ACTIVITY_ID);
  });

  it("com userId com inscrição APPROVED: retorna enrollmentStatus APPROVED", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        findByUserAndActivity: vi.fn().mockResolvedValue({ status: "APPROVED" }),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    const result = await service.findById(ACTIVITY_ID, USER_ID);

    expect(result.enrollmentStatus).toBe("APPROVED");
  });

  it("com userId com inscrição CANCELLED: retorna enrollmentStatus CANCELLED", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        findByUserAndActivity: vi.fn().mockResolvedValue({ status: "CANCELLED" }),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    const result = await service.findById(ACTIVITY_ID, USER_ID);

    expect(result.enrollmentStatus).toBe("CANCELLED");
  });

  it("com userId com inscrição PENDING: retorna enrollmentStatus PENDING", async () => {
    const { activityRepository, userRepository, enrollmentRepository } = mockRepositories({
      enrollment: {
        findByUserAndActivity: vi.fn().mockResolvedValue({ status: "PENDING" }),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository, enrollmentRepository });

    const result = await service.findById(ACTIVITY_ID, USER_ID);

    expect(result.enrollmentStatus).toBe("PENDING");
  });
});