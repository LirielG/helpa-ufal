import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { allowedTransitions } from "@/schemas/activity/ActivitySchemas.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { ActivityFullResponse, ActivityStatus } from "@/types/activity.js";
import { expectHttpError } from "@/utils/tests.js";

const ACTIVITY_ID = "2448a310-6c92-4db2-8389-2fbee52e81e9";
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const STATUSES: ActivityStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];
const TERMINAL: ActivityStatus[] = ["COMPLETED", "CANCELLED"];

// 4x4 matrix derived from the single source: 16 cases without 16 handwritten blocks.
const transitionCases = STATUSES.flatMap((from) =>
  STATUSES.map((to) => ({
    from,
    to,
    allowed: (allowedTransitions[from] ?? []).includes(to),
  })),
);

function makeActivityRecord(
  overrides: Partial<ActivityFullResponse> = {},
): ActivityFullResponse {
  return {
    id: ACTIVITY_ID,
    authorId: "author-1",
    title: "Oficina de Introdução à Programação",
    type: "COURSE",
    campus: "ARAPIRACA",
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    slots: 40,
    availableSlots: 27,
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
    findById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(makeActivityRecord()),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const enrollmentRepository = {
    findByUserAndActivity: vi.fn().mockResolvedValue(null),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, enrollmentRepository };
}

describe("ActivityService.updateStatus", () => {
  // ---------- Activity lookup ----------

  // Existence is verified before any user query.
  it("throws 404 when the activity does not exist or was deleted", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories();
    const service = new ActivityService({
      activityRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.updateStatus(ACTIVITY_ID, "IN_PROGRESS", {
        id: "user-1",
        isManager: false,
      }),
      404,
      "Activity not found.",
    );

    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivityRecord()) },
    });
    const service = new ActivityService({
      activityRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.updateStatus(ACTIVITY_ID, "IN_PROGRESS", {
        id: "user-2",
        isManager: false,
      }),
      403,
      "Forbidden. Requester is not the author or a manager.",
    );
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("an authenticated manager can transition another author's activity", async () => {
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(makeActivityRecord())
          .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS" })),
        updateStatus: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS" })),
      },
    });
    const service = new ActivityService({
      activityRepository,
      enrollmentRepository,
    });

    await service.updateStatus(ACTIVITY_ID, "IN_PROGRESS", {
      id: "manager-9",
      isManager: true,
    });

    expect(activityRepository.updateStatus).toHaveBeenCalledWith(
      ACTIVITY_ID,
      "IN_PROGRESS",
    );
  });

  // ---------- Transition matrix ----------

  it.each(transitionCases.filter((c) => c.allowed))(
    "accepts transition $from ->$to",
    async ({ from, to }) => {
      const { activityRepository, enrollmentRepository } = mockRepositories({
        activity: {
          findById: vi
            .fn()
            .mockResolvedValueOnce(makeActivityRecord({ status: from }))
            .mockResolvedValue(makeActivityRecord({ status: to })),
          updateStatus: vi
            .fn()
            .mockResolvedValue(makeActivityRecord({ status: to })),
        },
      });
      const service = new ActivityService({
        activityRepository,
        enrollmentRepository,
      });

      const result = await service.updateStatus(ACTIVITY_ID, to, {
        id: "author-1",
        isManager: false,
      });

      expect(activityRepository.updateStatus).toHaveBeenCalledWith(
        ACTIVITY_ID,
        to,
      );
      expect(result.status).toBe(to);
    },
  );

  // Terminal states have a distinct error from other invalid transitions.
  it.each(transitionCases.filter((c) => !c.allowed))(
    "rejects transition $from ->$to with 409",
    async ({ from, to }) => {
      const { activityRepository, enrollmentRepository } = mockRepositories({
        activity: {
          findById: vi
            .fn()
            .mockResolvedValue(makeActivityRecord({ status: from })),
        },
      });
      const service = new ActivityService({
        activityRepository,
        enrollmentRepository,
      });
      const expectedMessage = TERMINAL.includes(from)
        ? `Activity is already ${from} and cannot be transitioned.`
        : `Cannot transition from ${from} to ${to}.`;

      await expectHttpError(
        service.updateStatus(ACTIVITY_ID, to, {
          id: "author-1",
          isManager: false,
        }),
        409,
        expectedMessage,
      );
      expect(activityRepository.updateStatus).not.toHaveBeenCalled();
    },
  );

  it("returns the complete activity with canonical slots and the requester's enrollment", async () => {
    const updated = makeActivityRecord({
      status: "IN_PROGRESS",
      availableSlots: 27,
      details: {
        description: "Activity description",
        area: "Technology",
        format: "ONLINE",
        url: "https://example.com/meeting",
        workloadHours: 12,
        address: null,
      },
    });
    const { activityRepository, enrollmentRepository } = mockRepositories({
      activity: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(makeActivityRecord())
          .mockResolvedValue(updated),
      },
      enrollment: {
        findByUserAndActivity: vi
          .fn()
          .mockResolvedValue({ status: "APPROVED" }),
      },
    });
    const service = new ActivityService({
      activityRepository,
      enrollmentRepository,
    });

    const result = await service.updateStatus(updated.id, "IN_PROGRESS", {
      id: "author-1",
      isManager: false,
    });

    expect(result).toEqual({ ...updated, enrollmentStatus: "APPROVED" });
  });
});
