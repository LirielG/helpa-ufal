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

// 4x4 matrix derived from the single source: 16 cases without 16 handwritten blocks.
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

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(makeActivityRecord()),
    countApprovedEnrollments: vi.fn().mockResolvedValue(0),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  return { activityRepository };
}

describe("ActivityService.updateStatus", () => {
  // ---------- Activity lookup ----------

  // Existence is verified before any user query.
  it("throws 404 when the activity does not exist or was deleted", async () => {
    const { activityRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", {
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
    const { activityRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivityRecord()) },
    });
    const service = new ActivityService({ activityRepository });

    await expectHttpError(
      service.updateStatus("act-1", "IN_PROGRESS", {
        id: "user-2",
        isManager: false,
      }),
      403,
      "Forbidden. Requester is not the author or a manager.",
    );
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("an authenticated manager can transition another author's activity", async () => {
    const { activityRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi
          .fn()
          .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS" })),
      },
    });
    const service = new ActivityService({ activityRepository });

    await service.updateStatus("act-1", "IN_PROGRESS", {
      id: "manager-9",
      isManager: true,
    });

    expect(activityRepository.updateStatus).toHaveBeenCalledWith(
      "act-1",
      "IN_PROGRESS",
    );
  });

  // ---------- Transition matrix ----------

  it.each(transitionCases.filter((c) => c.allowed))(
    "accepts transition $from ->$to",
    async ({ from, to }) => {
      const { activityRepository } = mockRepositories({
        activity: {
          findById: vi
            .fn()
            .mockResolvedValue(makeActivityRecord({ status: from })),
          updateStatus: vi
            .fn()
            .mockResolvedValue(makeActivityRecord({ status: to })),
        },
      });
      const service = new ActivityService({
        activityRepository,
      });

      const result = await service.updateStatus("act-1", to, {
        id: "author-1",
        isManager: false,
      });

      expect(activityRepository.updateStatus).toHaveBeenCalledWith("act-1", to);
      expect(activityRepository.countApprovedEnrollments).toHaveBeenCalledTimes(
        1,
      );
      expect(result.status).toBe(to);
    },
  );

  // A mensagem esperada depende da ORIGEM. Origens terminais respondem com a
  // mensagem do contrato Bruno ("already ... cannot be transitioned.") — o que
  // EXIGE a guarda de terminal reordenada para antes de isValidTransition
  // (decisão da equipe; sem a reordenação estes casos falham). Origens não
  // terminais usam "Cannot transition from X to Y.". Os casos "pede o próprio
  // status" (COMPLETED→COMPLETED, CANCELLED→CANCELLED) estão cobertos aqui.
  it.each(transitionCases.filter((c) => !c.allowed))(
    "rejects transition $from ->$to with 409",
    async ({ from, to }) => {
      const { activityRepository } = mockRepositories({
        activity: {
          findById: vi
            .fn()
            .mockResolvedValue(makeActivityRecord({ status: from })),
        },
      });
      const service = new ActivityService({
        activityRepository,
      });
      const expectedMessage = TERMINAL.includes(from)
        ? `Activity is already ${from} and cannot be transitioned.`
        : `Cannot transition from ${from} to ${to}.`;

      await expectHttpError(
        service.updateStatus("act-1", to, { id: "author-1", isManager: false }),
        409,
        expectedMessage,
      );
      expect(activityRepository.updateStatus).not.toHaveBeenCalled();
      expect(
        activityRepository.countApprovedEnrollments,
      ).not.toHaveBeenCalled();
    },
  );

  // ---------- availableSlots recalculation ----------

  // Mirrors the Bruno contract example: 40 slots, 13 approved registrations.
  it("returns availableSlots recalculated from approved enrollments", async () => {
    const updated = makeActivityRecord({ status: "IN_PROGRESS" });
    const { activityRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi.fn().mockResolvedValue(updated),
        countApprovedEnrollments: vi.fn().mockResolvedValue(13),
      },
    });
    const service = new ActivityService({ activityRepository });

    const result = await service.updateStatus("act-1", "IN_PROGRESS", {
      id: "author-1",
      isManager: false,
    });

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
    expect(activityRepository.countApprovedEnrollments).toHaveBeenCalledWith(
      "act-1",
    );
  });

  // Inconsistent state possible while availableSlots lacks a single
  // source of truth (separate issue); Math.max(0, ...) safeguards the result.
  it("clamps availableSlots at zero when approved enrollments exceed slots", async () => {
    const { activityRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(makeActivityRecord()),
        updateStatus: vi
          .fn()
          .mockResolvedValue(
            makeActivityRecord({ status: "IN_PROGRESS", slots: 10 }),
          ),
        countApprovedEnrollments: vi.fn().mockResolvedValue(12),
      },
    });
    const service = new ActivityService({ activityRepository });

    const result = await service.updateStatus("act-1", "IN_PROGRESS", {
      id: "author-1",
      isManager: false,
    });

    expect(result.availableSlots).toBe(0);
  });
});
