import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { allowedTransitions } from "@/schemas/activity/ActivitySchemas.js";
import type { ActivityStatus } from "@/types/activity.js";
import { expectHttpError } from "@/utils/tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const STATUSES: ActivityStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];
const TERMINAL: ActivityStatus[] = ["COMPLETED", "CANCELLED"];

// Matriz 4x4 derivada da fonte única: 16 casos sem 16 blocos escritos à mão.
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

function makeActivityRecord(
  overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
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

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    updateStatus: vi.fn().mockResolvedValue(makeActivityRecord()),
    countApprovedEnrollments: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as IActivityRepository;
}

describe("ActivityService.updateStatus", () => {
  // ---------- Activity lookup ----------

  it("throws 404 when the activity does not exist or was deleted", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "user-1"),
      404,
      "Activity not found.",
    );
    // Existence is checked before any user lookup.
    expect(repository.findUserById).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "user-2"),
      403,
      "Forbidden. Requester is not the author or a manager.",
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists, even if they were the author", async () => {
    // Ghost user: authorship requires a user that still exists in the
    // database, so a valid token alone is not enough. The mirror of this case
    // lives in ActivityService.update.test.ts.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      findUserById: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", "author-1"),
      403,
    );
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("a manager (checked in the database) can transition another author's activity", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      findUserById: vi.fn().mockResolvedValue({ isManager: true }),
      updateStatus: vi
        .fn()
        .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS" })),
    });
    const service = new ActivityService({ activityRepository: repository });

    await service.updateStatus("act-1", "IN_PROGRESS", "manager-9");

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "act-1",
      "IN_PROGRESS",
    );
  });

  // ---------- Transition matrix ----------

  it.each(transitionCases.filter((c) => c.allowed))(
    "accepts transition $from -> $to",
    async ({ from, to }) => {
      const repository = mockRepository({
        findById: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: from })),
        updateStatus: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: to })),
      });
      const service = new ActivityService({ activityRepository: repository });

      const result = await service.updateStatus("act-1", to, "author-1");

      expect(repository.updateStatus).toHaveBeenCalledWith("act-1", to);
      expect(repository.countApprovedEnrollments).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(to);
    },
  );

  // The expected message depends on the SOURCE status. Terminal sources answer
  // with the Bruno contract message ("already ... cannot be transitioned."),
  // which REQUIRES the terminal guard to run before isValidTransition — these
  // cases fail if the two are swapped. Non-terminal sources get "Cannot
  // transition from X to Y.". Asking for the status an activity already has
  // (COMPLETED->COMPLETED, CANCELLED->CANCELLED) is covered here too.
  it.each(transitionCases.filter((c) => !c.allowed))(
    "rejects transition $from -> $to with 409",
    async ({ from, to }) => {
      const repository = mockRepository({
        findById: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: from })),
      });
      const service = new ActivityService({ activityRepository: repository });

      const expectedMessage = TERMINAL.includes(from)
        ? `Activity is already ${from} and cannot be transitioned.`
        : `Cannot transition from ${from} to ${to}.`;

      await expectHttpError(
        service.updateStatus("act-1", to, "author-1"),
        409,
        expectedMessage,
      );
      expect(repository.updateStatus).not.toHaveBeenCalled();
      expect(repository.countApprovedEnrollments).not.toHaveBeenCalled();
    },
  );

  // ---------- availableSlots recalculation ----------

  it("returns availableSlots recalculated from approved enrollments", async () => {
    // Mirrors the example in the Bruno contract: 40 slots, 13 approved.
    const updated = makeActivityRecord({ status: "IN_PROGRESS" });
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      updateStatus: vi.fn().mockResolvedValue(updated),
      countApprovedEnrollments: vi.fn().mockResolvedValue(13),
    });
    const service = new ActivityService({ activityRepository: repository });

    const result = await service.updateStatus(
      "act-1",
      "IN_PROGRESS",
      "author-1",
    );

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
    expect(repository.countApprovedEnrollments).toHaveBeenCalledWith("act-1");
  });

  it("clamps availableSlots at zero when approved enrollments exceed slots", async () => {
    // Slots can be lowered below the number of approved enrollments, so the
    // subtraction can go negative; Math.max(0, ...) keeps that out of the
    // response.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      updateStatus: vi
        .fn()
        .mockResolvedValue(
          makeActivityRecord({ status: "IN_PROGRESS", slots: 10 }),
        ),
      countApprovedEnrollments: vi.fn().mockResolvedValue(12),
    });
    const service = new ActivityService({ activityRepository: repository });

    const result = await service.updateStatus(
      "act-1",
      "IN_PROGRESS",
      "author-1",
    );

    expect(result.availableSlots).toBe(0);
  });
});
