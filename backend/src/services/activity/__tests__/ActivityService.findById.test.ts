import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import { expectCustomError } from "@/utils/tests.js";

const ACTIVITY_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const USER_ID = "a1b2c3d4-0000-4000-8000-000000000099";
const OTHER_USER_ID = "a1b2c3d4-0000-4000-8000-000000000088";
const MANAGER_ID = "a1b2c3d4-0000-4000-8000-000000000077";

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
  moderation: null,
};

const removedModeration = {
  removedAt: new Date("2026-10-01T12:00:00.000Z"),
  justification: "Violou as diretrizes da plataforma.",
};

function buildService(
  overrides: {
    activity?: Partial<IActivityRepository>;
    enrollment?: Partial<IEnrollmentRepository>;
    report?: Partial<IActivityReportRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(fakeActivity),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  const activityReportRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    ...overrides.report,
  } as unknown as IActivityReportRepository;

  const service = new ActivityService({
    activityRepository,
    enrollmentRepository,
    activityReportRepository,
  });

  return { service, enrollmentRepository, activityReportRepository };
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

    const result = await service.findById(ACTIVITY_ID, {
      id: USER_ID,
      isManager: false,
    });

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

      const result = await service.findById(ACTIVITY_ID, {
        id: USER_ID,
        isManager: false,
      });

      expect(result.enrollmentStatus).toBe(status);
    },
  );

  it("throws 410 ACTIVITY_REMOVED for an anonymous caller when the activity was removed by moderation", async () => {
    const { service, enrollmentRepository } = buildService({
      activity: {
        findById: vi.fn().mockResolvedValue({
          ...fakeActivity,
          moderation: removedModeration,
        }),
      },
    });

    await expectCustomError(
      service.findById(ACTIVITY_ID),
      410,
      "This activity was removed by moderation.",
      "ACTIVITY_REMOVED",
    );
    expect(enrollmentRepository.findByUserAndActivity).not.toHaveBeenCalled();
  });

  it("throws 410 ACTIVITY_REMOVED for a regular user who is neither author nor manager", async () => {
    const { service, enrollmentRepository } = buildService({
      activity: {
        findById: vi.fn().mockResolvedValue({
          ...fakeActivity,
          moderation: removedModeration,
        }),
      },
    });

    await expectCustomError(
      service.findById(ACTIVITY_ID, { id: OTHER_USER_ID, isManager: false }),
      410,
      "This activity was removed by moderation.",
      "ACTIVITY_REMOVED",
    );
    expect(enrollmentRepository.findByUserAndActivity).not.toHaveBeenCalled();
  });

  it("returns 200 with moderation populated for the author", async () => {
    const { service } = buildService({
      activity: {
        findById: vi.fn().mockResolvedValue({
          ...fakeActivity,
          moderation: removedModeration,
        }),
      },
    });

    const result = await service.findById(ACTIVITY_ID, {
      id: USER_ID,
      isManager: false,
    });

    expect(result.moderation).toEqual(removedModeration);
    expect(result.enrollmentStatus).toBeNull();
  });

  it("returns 200 with moderation populated for a manager", async () => {
    const { service } = buildService({
      activity: {
        findById: vi.fn().mockResolvedValue({
          ...fakeActivity,
          moderation: removedModeration,
        }),
      },
    });

    const result = await service.findById(ACTIVITY_ID, {
      id: MANAGER_ID,
      isManager: true,
    });

    expect(result.moderation).toEqual(removedModeration);
    expect(result.enrollmentStatus).toBeNull();
  });

  // ---------- reportedByMe ----------

  it("returns reportedByMe false and skips the report lookup without a user", async () => {
    const { service, activityReportRepository } = buildService();

    const result = await service.findById(ACTIVITY_ID);

    // Unlike enrollmentStatus, the key is present even for an anonymous caller.
    expect(result).toHaveProperty("reportedByMe", false);
    expect(result).not.toHaveProperty("enrollmentStatus");
    expect(
      activityReportRepository.findByUserAndActivity,
    ).not.toHaveBeenCalled();
  });

  it("returns reportedByMe false when the user never reported the activity", async () => {
    const { service, activityReportRepository } = buildService();

    const result = await service.findById(ACTIVITY_ID, {
      id: USER_ID,
      isManager: false,
    });

    expect(result).toHaveProperty("reportedByMe", false);
    expect(activityReportRepository.findByUserAndActivity).toHaveBeenCalledWith(
      USER_ID,
      ACTIVITY_ID,
    );
  });

  it.each([
    { label: "still open", report: { id: "r1", decisionId: null } },
    { label: "already decided", report: { id: "r1", decisionId: "d1" } },
  ])(
    "returns reportedByMe true when the user's report is $label",
    async ({ report }) => {
      const { service } = buildService({
        report: { findByUserAndActivity: vi.fn().mockResolvedValue(report) },
      });

      const result = await service.findById(ACTIVITY_ID, {
        id: USER_ID,
        isManager: false,
      });

      expect(result.reportedByMe).toBe(true);
    },
  );

  it("reports enrollmentStatus and reportedByMe independently of each other", async () => {
    const { service } = buildService({
      enrollment: {
        findByUserAndActivity: vi
          .fn()
          .mockResolvedValue({ status: "APPROVED" }),
      },
      report: {
        findByUserAndActivity: vi.fn().mockResolvedValue({ id: "r1" }),
      },
    });

    const result = await service.findById(ACTIVITY_ID, {
      id: USER_ID,
      isManager: false,
    });

    expect(result).toMatchObject({
      enrollmentStatus: "APPROVED",
      reportedByMe: true,
    });
  });

  it("does not fall back to an anonymous-looking answer when the report lookup fails", async () => {
    const { service } = buildService({
      report: {
        findByUserAndActivity: vi.fn().mockRejectedValue(new Error("db down")),
      },
    });

    await expect(
      service.findById(ACTIVITY_ID, {
        id: USER_ID,
        isManager: false,
      }),
    ).rejects.toThrow("db down");
  });
});
