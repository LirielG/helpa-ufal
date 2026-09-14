import { describe, it, expect, vi, afterEach } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import {
  expectValidationError,
  expectCustomError,
} from "@/utils/tests.js";
import { daysFromNow } from "../../../../tests/helpers/dates.js";

const AUTHOR_ID = "a1b2c3d4-0000-4000-8000-000000000099";
const CREATED_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const validAddress = {
  addressLine: "Av. Manoel Severino Barbosa, s/n",
  district: "Bom Sucesso",
  zipCode: "57309005",
  city: "Arapiraca",
  state: "AL",
};

// Base valid payload: a 2-day IN_PERSON activity (48h total). Overrides stay
// untyped on purpose: some tests send payloads the Zod contract would reject.
function validInput(overrides: Record<string, unknown> = {}): CreateActivityInput {
  return {
    title: "Oficina de Introdução à Programação",
    type: "EXTENSION",
    campus: "MACEIO",
    startDate: daysFromNow(10),
    endDate: daysFromNow(12),
    slots: 40,
    description: "Introdução à lógica de programação para iniciantes.",
    area: "Tecnologia",
    workloadHours: 20,
    format: "IN_PERSON",
    address: validAddress,
    ...overrides,
  } as unknown as CreateActivityInput;
}

// Only the fields the service reads.
function createdActivityFrom(authorId: string, data: CreateActivityInput) {
  return {
    id: CREATED_ID,
    authorId,
    title: data.title,
    type: data.type,
    campus: data.campus,
    startDate: data.startDate,
    endDate: data.endDate,
    slots: data.slots,
    status: "OPEN",
  };
}

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    create: vi
      .fn()
      .mockImplementation((authorId: string, data: CreateActivityInput) =>
        Promise.resolve(createdActivityFrom(authorId, data)),
      ),
    ...overrides,
  } as unknown as IActivityRepository;
}

describe("ActivityService.create", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------- Block 1: dates (ValidationError, accumulated) ----------

  it("rejects a startDate in the past", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ startDate: daysFromNow(-1) });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "startDate", message: "startDate must be in the future." },
    ]);
  });

  it("rejects an endDate equal to startDate (the comparison is inclusive)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // Same Date instance: two daysFromNow(10) calls could differ by 1ms.
    const start = daysFromNow(10);
    const input = validInput({ startDate: start, endDate: start });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "endDate", message: "endDate must be after startDate." },
    ]);
  });

  it("rejects a duration longer than 365 days", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      startDate: daysFromNow(10),
      endDate: daysFromNow(376),
    });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      {
        field: "endDate",
        message: "Activity duration cannot exceed 365 days.",
      },
    ]);
  });

  it("rejects a startDate more than 365 days in the future", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      startDate: daysFromNow(366),
      endDate: daysFromNow(367),
    });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      {
        field: "startDate",
        message: "startDate cannot be more than 365 days in the future.",
      },
    ]);
  });

  it("accumulates date errors in a single ValidationError, in check order", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      startDate: daysFromNow(-2),
      endDate: daysFromNow(-3),
    });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "startDate", message: "startDate must be in the future." },
      { field: "endDate", message: "endDate must be after startDate." },
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a startDate equal to now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));

    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      startDate: new Date("2026-09-09T12:00:00.000Z"),
      endDate: daysFromNow(2),
    });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "startDate", message: "startDate must be in the future." },
    ]);
  });

  // ---------- Block 2: capacity (ValidationError, accumulated) ----------

  it("rejects workloadHours above the total duration in hours", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // A 2-day activity lasts 48h: 49h is the cheapest way to break the rule.
    const input = validInput({ workloadHours: 49 });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      {
        field: "workloadHours",
        message:
          "workloadHours cannot exceed the total duration of the activity.",
      },
    ]);
  });

  it("reports both workloadHours errors together: the 8760 cap never fires alone", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // Reaching block 2 requires duration <= 365 days (<= 8760h), so any
    // workloadHours > 8760 also exceeds the total duration — duration first.
    const input = validInput({
      startDate: daysFromNow(1),
      endDate: daysFromNow(366), // exactly 365 days: survives block 1
      workloadHours: 8761,
    });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      {
        field: "workloadHours",
        message:
          "workloadHours cannot exceed the total duration of the activity.",
      },
      { field: "workloadHours", message: "workloadHours cannot exceed 8760." },
    ]);
  });

  it("rejects slots above 10000", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ slots: 10_001 });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "slots", message: "slots cannot exceed 10000." },
    ]);
  });

  // ---------- Block 3: format (CustomError 400, first failure wins) ----------

  it("rejects IN_PERSON without an address", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ address: undefined });

    await expectCustomError(
      service.create(AUTHOR_ID, input),
      400,
      "IN_PERSON activities require an address.",
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects HYBRID without an address", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      format: "HYBRID",
      url: "https://meet.example.com/oficina",
      address: undefined,
    });

    await expectCustomError(
      service.create(AUTHOR_ID, input),
      400,
      "HYBRID activities require an address.",
    );
  });

  it("rejects HYBRID without a url", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ format: "HYBRID" });

    await expectCustomError(
      service.create(AUTHOR_ID, input),
      400,
      "HYBRID activities require a url.",
    );
  });

  it("reports only the address error when HYBRID misses both address and url", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // First-failure block: the url check is never reached.
    const input = validInput({ format: "HYBRID", address: undefined });

    await expectCustomError(
      service.create(AUTHOR_ID, input),
      400,
      "HYBRID activities require an address.",
    );
  });

  // ---------- Precedence between blocks ----------

  it("reports only the date error when dates and slots are both invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ startDate: daysFromNow(-1), slots: 20_000 });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "startDate", message: "startDate must be in the future." },
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("reports only the capacity error when slots and format are both invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // Capacity (ValidationError) runs before format (CustomError).
    const input = validInput({ slots: 20_000, address: undefined });

    await expectValidationError(service.create(AUTHOR_ID, input), [
      { field: "slots", message: "slots cannot exceed 10000." },
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  // ---------- Boundaries (the comparisons are strict) ----------

  it("accepts slots exactly at the 10000 limit", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const response = await service.create(
      AUTHOR_ID,
      validInput({ slots: 10_000 }),
    );

    expect(response.slots).toBe(10_000);
    expect(response.availableSlots).toBe(10_000);
  });

  it("accepts workloadHours equal to the exact total duration", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({ workloadHours: 48 });

    await expect(service.create(AUTHOR_ID, input)).resolves.toMatchObject({
      status: "OPEN",
    });
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("accepts a duration of exactly 365 days", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput({
      startDate: daysFromNow(1),
      endDate: daysFromNow(366),
    });

    await expect(service.create(AUTHOR_ID, input)).resolves.toBeDefined();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  // ---------- Happy path ----------

  it("passes authorId and the input untouched to the repository and returns the exact DTO", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const input = validInput();
    const response = await service.create(AUTHOR_ID, input);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(AUTHOR_ID, input);
    // Exact shape: no `details` (the Bruno 201 example shows it — contract debt).
    expect(response).toEqual({
      id: CREATED_ID,
      authorId: AUTHOR_ID,
      title: input.title,
      type: input.type,
      campus: input.campus,
      startDate: input.startDate,
      endDate: input.endDate,
      slots: input.slots,
      availableSlots: input.slots,
      status: "OPEN",
    });
  });

  it("takes availableSlots from the persisted row, not from the request payload", async () => {
    const input = validInput({ slots: 40 });
    const repository = mockRepository({
      create: vi
        .fn()
        .mockResolvedValue({
          ...createdActivityFrom(AUTHOR_ID, input),
          slots: 30,
        }),
    });
    const service = new ActivityService({ activityRepository: repository });

    const response = await service.create(AUTHOR_ID, input);

    expect(response.slots).toBe(30);
    expect(response.availableSlots).toBe(30);
  });

  it("creates an ONLINE activity without url or address", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    // Today's behavior: the event link may not exist yet at creation time.
    // Bypasses the Zod contract (url is required for ONLINE there); if the
    // team changes the rule, this test is the detector.
    const input = validInput({ format: "ONLINE", address: undefined });

    const response = await service.create(AUTHOR_ID, input);

    expect(repository.create).toHaveBeenCalledWith(AUTHOR_ID, input);
    expect(response.status).toBe("OPEN");
  });

  // ---------- Repository failure ----------

  it("propagates repository rejections unchanged (no wrapping)", async () => {
    const infraError = new Error("database is down");
    const repository = mockRepository({
      create: vi.fn().mockRejectedValue(infraError),
    });
    const service = new ActivityService({ activityRepository: repository });

    await expect(service.create(AUTHOR_ID, validInput())).rejects.toBe(
      infraError,
    );
  });
});
