import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { allowedTransitions } from "@/schemas/activity/ActivitySchemas.js";
import type { ActivityStatus } from "@/types/activity.js";
import { expectHttpError } from "@/utils/tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const STATUSES: ActivityStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const TERMINAL: ActivityStatus[] = ["COMPLETED", "CANCELLED"];

const transitionCases = STATUSES.flatMap((from) =>
  STATUSES.map((to) => ({
    from,
    to,
    allowed: (allowedTransitions[from] ?? []).includes(to),
  })),
);

type ActivityRecord = {
  id: string;
  authorId: string;
  title: string;
  type: string;
  campus: string;
  startDate: Date;
  endDate: Date;
  slots: number;
  availableSlots: number;
  status: string;
};

function makeActivityRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: "act-1",
    authorId: "author-1",
    title: "Oficina de Introdução à Programação",
    type: "COURSE",
    campus: "ARAPIRACA",
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    slots: 40,
    availableSlots: 27,
    status: "OPEN",
    ...overrides,
  };
}

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
    user?: Partial<IUserRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(makeActivityRecord()),
    countApprovedEnrollments: vi.fn().mockResolvedValue(0),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.user,
  } as unknown as IUserRepository;

  return { activityRepository, userRepository };
}

describe("ActivityService.updateStatus", () => {
  // ---------- Activity lookup ----------

  it("throws 404 when the activity does not exist or was deleted", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "user-1"),
      404,
      "Activity not found.",
    );
    expect(userRepository.findUserById).not.toHaveBeenCalled();
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivityRecord()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "user-2"),
      403,
      "Forbidden. Requester is not the author or a manager.",
    );
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists, even if they were the author", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivityRecord()) },
      user: { findUserById: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "author-1"),
      403,
    );
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("a manager (checked in the database) can transition another author's activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS" })),
      },
      user: { findUserById: vi.fn().mockResolvedValue({ isManager: true }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.updateStatus("act-1", "IN_PROGRESS", "manager-9");

    expect(activityRepository.updateStatus).toHaveBeenCalledWith("act-1", "IN_PROGRESS");
  });

  // ---------- Transition matrix ----------

  it.each(transitionCases.filter((c) => c.allowed))(
    "accepts transition $from ->$to",
    async ({ from, to }) => {
      const { activityRepository, userRepository } = mockRepositories({
        activity: {
          findById: vi.fn().mockResolvedValue(makeActivityRecord({ status: from })),
          updateStatus: vi.fn().mockResolvedValue(makeActivityRecord({ status: to })),
        },
      });
      const service = new ActivityService({ activityRepository, userRepository });

      const result = await service.updateStatus("act-1", to, "author-1");

      expect(activityRepository.updateStatus).toHaveBeenCalledWith("act-1", to);
      expect(activityRepository.countApprovedEnrollments).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(to);
    },
  );

  it.each(transitionCases.filter((c) => !c.allowed))(
    "rejects transition $from ->$to with 409",
    async ({ from, to }) => {
      const { activityRepository, userRepository } = mockRepositories({
        activity: {
          findById: vi.fn().mockResolvedValue(makeActivityRecord({ status: from })),
        },
      });
      const service = new ActivityService({ activityRepository, userRepository });

      const expectedMessage = TERMINAL.includes(from)
        ? `Activity is already ${from} and cannot be transitioned.`
        : `Cannot transition from ${from} to ${to}.`;

      await expectHttpError(
        service.updateStatus("act-1", to, "author-1"),
        409,
        expectedMessage,
      );
      expect(activityRepository.updateStatus).not.toHaveBeenCalled();
      expect(activityRepository.countApprovedEnrollments).not.toHaveBeenCalled();
    },
  );

  // ---------- availableSlots recalculation ----------

  it("returns availableSlots recalculated from approved enrollments", async () => {
    const updated = makeActivityRecord({ status: "IN_PROGRESS" });
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi.fn().mockResolvedValue(updated),
        countApprovedEnrollments: vi.fn().mockResolvedValue(13),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const result = await service.updateStatus("act-1", "IN_PROGRESS", "author-1");

    expect(result).toEqual({
      id: updated.id,
      authorId: updated.authorId,
      title: updated.title,
      type: updated.type,
      campus: updated.campus,
      startDate: updated.startDate,
      endDate: updated.endDate,
      slots: 40,
      availableSlots: 27,
      status: "IN_PROGRESS",
    });
    expect(activityRepository.countApprovedEnrollments).toHaveBeenCalledWith("act-1");
  });

  it("clamps availableSlots at zero when approved enrollments exceed slots", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS", slots: 10 })),
        countApprovedEnrollments: vi.fn().mockResolvedValue(12),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const result = await service.updateStatus("act-1", "IN_PROGRESS", "author-1");

    expect(result.availableSlots).toBe(0);
  });
});