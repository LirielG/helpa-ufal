import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { allowedTransitions } from "@/schemas/activity/ActivitySchemas.js";
import type { ActivityStatus } from "@/types/activity.js";
import { expectHttpError } from "@/utils/tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const STATUSES: ActivityStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
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
    // Existência é verificada antes de qualquer consulta de usuário.
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
    // Ghost user: a autoria exige usuário vivo no banco. É essa consulta que
    // a #148 levará ao update — ver o espelho deste caso em
    // ActivityService.update.test.ts.
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

    expect(repository.updateStatus).toHaveBeenCalledWith("act-1", "IN_PROGRESS");
  });

  // ---------- Transition matrix ----------

  it.each(transitionCases.filter((c) => c.allowed))(
    "accepts transition $from -> $to",
    async ({ from, to }) => {
      const repository = mockRepository({
        findById: vi.fn().mockResolvedValue(makeActivityRecord({ status: from })),
        updateStatus: vi.fn().mockResolvedValue(makeActivityRecord({ status: to })),
      });
      const service = new ActivityService({ activityRepository: repository });

      const result = await service.updateStatus("act-1", to, "author-1");

      expect(repository.updateStatus).toHaveBeenCalledWith("act-1", to);
      expect(repository.countApprovedEnrollments).toHaveBeenCalledTimes(1);
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
    "rejects transition $from -> $to with 409",
    async ({ from, to }) => {
      const repository = mockRepository({
        findById: vi.fn().mockResolvedValue(makeActivityRecord({ status: from })),
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
    // Espelha o exemplo do contrato Bruno: slots 40, 13 inscrições aprovadas.
    const updated = makeActivityRecord({ status: "IN_PROGRESS" });
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      updateStatus: vi.fn().mockResolvedValue(updated),
      countApprovedEnrollments: vi.fn().mockResolvedValue(13),
    });
    const service = new ActivityService({ activityRepository: repository });

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
    expect(repository.countApprovedEnrollments).toHaveBeenCalledWith("act-1");
  });

  it("clamps availableSlots at zero when approved enrollments exceed slots", async () => {
    // Estado inconsistente possível enquanto availableSlots não tem fonte
    // única (issue separada); o Math.max(0, ...) protege a resposta.
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue(makeActivityRecord()),
      updateStatus: vi
        .fn()
        .mockResolvedValue(makeActivityRecord({ status: "IN_PROGRESS", slots: 10 })),
      countApprovedEnrollments: vi.fn().mockResolvedValue(12),
    });
    const service = new ActivityService({ activityRepository: repository });

    const result = await service.updateStatus("act-1", "IN_PROGRESS", "author-1");

    expect(result.availableSlots).toBe(0);
  });
});
