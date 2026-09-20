import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import ValidationError from "@/models/error/ValidationError.js";
import { expectHttpError } from "@/utils/tests.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const ADDRESS = {
  addressLine: "Av. Manoel Severino Barbosa, s/n",
  district: "Bom Sucesso",
  zipCode: "57309005",
  city: "Arapiraca",
  state: "AL",
} as const;

const AUTHOR = "author-1";
const MANAGER = "manager-9";
const THIRD_PARTY = "user-2";

type StoredDetails = {
  workloadHours: number;
  format: string;
  url?: string;
  address?: typeof ADDRESS | null;
};

type StoredActivity = {
  id: string;
  authorId: string;
  status: string;
  startDate: Date;
  endDate: Date;
  slots: number;
  availableSlots: number;
  details: StoredDetails | null;
};

function makeActivity(overrides: Partial<StoredActivity> = {}): StoredActivity {
  const { details, ...rest } = overrides;
  return {
    id: "act-1",
    authorId: "author-1",
    status: "OPEN",
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    slots: 40,
    availableSlots: 40,
    details:
      details === undefined
        ? { workloadHours: 8, format: "IN_PERSON", address: ADDRESS }
        : details,
    ...rest,
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
    update: vi
      .fn()
      .mockImplementation((id: string, data: object) =>
        Promise.resolve({ id, ...data }),
      ),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {
    findById: vi.fn().mockImplementation(async (id: string) => {
      if (id === MANAGER) return { isManager: true };
      if (id === AUTHOR || id === THIRD_PARTY) return { isManager: false };
      return null;
    }),
    ...overrides.user,
  } as unknown as IUserRepository;

  return { activityRepository, userRepository };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject, but it resolved.");
}

describe("ActivityService.update", () => {
  // ---------- Activity lookup ----------

  it("throws 404 when the activity does not exist or was deleted", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      404,
      "Activity not found.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", THIRD_PARTY, { title: "x" }),
      403,
      "You do not have permission to update this activity.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("throws 403 (not 409) when a third party targets a completed activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity({ status: "COMPLETED" })) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.update("act-1", THIRD_PARTY, { title: "x" }), 403);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("allows a deleted user with a valid token to update (defect pinned until #148)", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
      user: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { title: "Novo título" });

    expect(activityRepository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Status guard ----------

  it("throws 409 when the activity is COMPLETED", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity({ status: "COMPLETED" })) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      409,
      "Activity cannot be updated because it is already COMPLETED.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("throws 409 when the activity is CANCELLED", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity({ status: "CANCELLED" })) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { title: "x" }),
      409,
      "Activity cannot be updated because it is already CANCELLED.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  // ---------- Happy path ----------

  it("the author can update their own activity", async () => {
    const stored = makeActivity();
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(stored),
        update: vi.fn().mockResolvedValue(stored),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const result = await service.update("act-1", AUTHOR, {
      title: "Oficina de Introdução à Programação — Turma 2",
      slots: 50,
    });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { title: "Oficina de Introdução à Programação — Turma 2", slots: 50 },
      "NONE",
    );
    expect(result).toBe(stored);
  });

  it("a manager can update another author's activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", MANAGER, { title: "Editado pelo gestor" });

    expect(activityRepository.update).toHaveBeenCalledTimes(1);
  });

  it("a manager can update their own activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity({ authorId: "manager-9" })) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", MANAGER, { title: "Minha própria ação" });

    expect(activityRepository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Partial updates ----------

  it("forwards only the sent fields to the repository", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { title: "Só título" });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { title: "Só título" },
      "NONE",
    );
  });

  it("skips date validation when no date is sent, even with a past startDate", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi
          .fn()
          .mockResolvedValue(
            makeActivity({ startDate: daysFromNow(-5), endDate: daysFromNow(-3) }),
          ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { title: "Ação antiga" });

    expect(activityRepository.update).toHaveBeenCalledTimes(1);
  });

  // ---------- Date validation ----------

  it("rejects a past startDate with ValidationError on startDate", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { startDate: daysFromNow(-1) }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "startDate", message: "startDate must be in the future." },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("rejects an endDate earlier than the merged startDate", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { endDate: daysFromNow(5) }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "endDate", message: "endDate must be after startDate." },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("accepts valid dates and forwards them to the repository", async () => {
    const startDate = daysFromNow(20);
    const endDate = daysFromNow(22);
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { startDate, endDate });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { startDate, endDate },
      "NONE",
    );
  });

  it("rejects a duration above the maximum", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, {
        startDate: daysFromNow(20),
        endDate: daysFromNow(386),
      }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "endDate", message: "Activity duration cannot exceed 365 days." },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("rejects a startDate too far in the future", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, {
        startDate: daysFromNow(400),
        endDate: daysFromNow(402),
      }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      {
        field: "startDate",
        message: "startDate cannot be more than 365 days in the future.",
      },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  // ---------- Slots and workload ----------

  it("rejects slots below the number of approved enrollments", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi
          .fn()
          .mockResolvedValue(makeActivity({ slots: 40, availableSlots: 27 })),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(service.update("act-1", AUTHOR, { slots: 10 }));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      {
        field: "slots",
        message:
          "slots cannot be reduced below the current number of approved enrollments (13).",
      },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("rejects slots above the maximum", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { slots: 10_001 }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { field: "slots", message: "slots cannot exceed 10000." },
    ]);
  });

  it("rejects workloadHours above the activity duration", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    const error = await captureError(
      service.update("act-1", AUTHOR, { workloadHours: 100 }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      {
        field: "workloadHours",
        message: "workloadHours cannot exceed the total duration of the activity.",
      },
    ]);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  // ---------- Format, url and address ----------

  it("rejects ONLINE when no url is sent and none is stored", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "ONLINE" }),
      400,
      "ONLINE activities require a url.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("accepts ONLINE using the stored url and schedules address deletion", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "HYBRID",
              url: "https://meet.example.com/turma2",
              address: ADDRESS,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { format: "ONLINE" });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      expect.objectContaining({ format: "ONLINE" }),
      "DELETE",
    );
  });

  it("accepts IN_PERSON using the stored address (no address in payload)", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "HYBRID",
              url: "https://meet.example.com/turma2",
              address: ADDRESS,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { format: "IN_PERSON" });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { format: "IN_PERSON" },
      "NONE",
    );
  });

  it("rejects IN_PERSON when no address exists and none is sent", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "ONLINE",
              url: "https://meet.example.com/turma2",
              address: null,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "IN_PERSON" }),
      400,
      "IN_PERSON activities require an address.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("rejects HYBRID when no address exists and none is sent", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "ONLINE",
              url: "https://meet.example.com/turma2",
              address: null,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(
      service.update("act-1", AUTHOR, { format: "HYBRID" }),
      400,
      "HYBRID activities require an address.",
    );
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it("schedules address update when only a new address is sent", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue(makeActivity()) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, {
      address: { ...ADDRESS, district: "Centro" },
    });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { address: { ...ADDRESS, district: "Centro" } },
      "UPDATE",
    );
  });

  it("schedules address creation when the new format requires one", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "ONLINE",
              url: "https://meet.example.com/turma2",
              address: null,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { format: "IN_PERSON", address: ADDRESS });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      { format: "IN_PERSON", address: ADDRESS },
      "CREATE",
    );
  });

  it("drops a sent address when the activity is ONLINE", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue(
          makeActivity({
            details: {
              workloadHours: 8,
              format: "ONLINE",
              url: "https://meet.example.com/turma2",
              address: null,
            },
          }),
        ),
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.update("act-1", AUTHOR, { address: ADDRESS });

    expect(activityRepository.update).toHaveBeenCalledWith(
      "act-1",
      expect.objectContaining({ address: null }),
      "NONE",
    );
  });
});