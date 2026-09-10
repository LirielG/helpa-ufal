import { describe, it, expect, vi } from "vitest";
import ActivityReportService from "../ActivityReportService.js";
import type { IActivityReportRepository } from "@/repositories/activityReport/IActivityReportRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";
import type { ActivityReportResponse } from "@/types/activityReport.js";
import {
  expectValidationError,
  expectCustomError,
} from "@/utils/tests.js";


// v4 UUIDs only: isValidUUID rejects anything else (project convention).
const ACTIVITY_ID = "22ac40bd-e160-4c6e-8505-b63913d2482f"; // from the Bruno contract
const REPORTER_ID = "a1b2c3d4-0000-4000-8000-000000000042";
const AUTHOR_ID = "a1b2c3d4-0000-4000-8000-000000000099";
const REPORT_ID = "b2c3d4e5-0000-4000-8000-000000000007";
const CREATED_AT = new Date("2026-06-05T19:44:20.000Z");

// Duplicated in code on purpose: inventing a "missing" category would test
// nothing. Values confirmed against the Prisma enum ReportReason.
const REPORT_REASONS = [
  "SPAM",
  "INAPPROPRIATE_CONTENT",
  "MISINFORMATION",
  "DUPLICATE",
  "OTHER",
] as const;


// Mirrors toActivityReportResponse: fields come from the persisted row, and
// moderation fields (resolvedAt/resolvedById) stay out until Sprint 5.
function reportFactory(
  activityId: string,
  userId: string,
  data: CreateActivityReportInput,
): ActivityReportResponse {
  return {
    id: REPORT_ID,
    activityId,
    userId,
    category: data.category,
    description: data.description ?? null,
    createdAt: CREATED_AT,
  };
}


// Only the field the service reads.
function activityFrom(authorId: string) {
  return { id: ACTIVITY_ID, authorId };
}


function mockReportRepository(
  overrides: Partial<IActivityReportRepository> = {},
): IActivityReportRepository {
  return {
    create: vi
      .fn()
      .mockImplementation(
        (activityId: string, userId: string, data: CreateActivityReportInput) =>
          Promise.resolve(reportFactory(activityId, userId, data)),
      ),
    findByUserAndActivity: vi.fn(),
    ...overrides,
  } as unknown as IActivityReportRepository;
}


function mockActivityRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn(),
    ...overrides,
  } as unknown as IActivityRepository;
}


// Base valid payload: a MISINFORMATION report with description. Overrides stay
// untyped on purpose: one test sends a payload the Zod contract would reject.
function validInput(
  overrides: Record<string, unknown> = {},
): CreateActivityReportInput {
  return {
    category: "MISINFORMATION",
    description: "The address provided is incorrect.",
    ...overrides,
  } as unknown as CreateActivityReportInput;
}


describe("ActivityReportService.createReport", () => {
  // ---------- Happy path ----------


  it("passes ids and data untouched to the repository and returns its exact DTO", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository({
      findByUserAndActivity: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    const input = validInput();
    const response = await service.createReport(ACTIVITY_ID, REPORTER_ID, input);


    expect(activityRepository.findById).toHaveBeenCalledTimes(1);
    expect(activityRepository.findById).toHaveBeenCalledWith(ACTIVITY_ID);
    expect(reportRepository.findByUserAndActivity).toHaveBeenCalledTimes(1);
    expect(reportRepository.findByUserAndActivity).toHaveBeenCalledWith(
      REPORTER_ID,
      ACTIVITY_ID,
    );
    expect(reportRepository.create).toHaveBeenCalledTimes(1);
    expect(reportRepository.create).toHaveBeenCalledWith(
      ACTIVITY_ID,
      REPORTER_ID,
      input,
    );
    // Exact shape: the service returns the repository row as-is, so the DTO
    // mirrors the mock, not the payload. Extra fields must fail this test.
    expect(response).toEqual({
      id: REPORT_ID,
      activityId: ACTIVITY_ID,
      userId: REPORTER_ID,
      category: input.category,
      description: input.description,
      createdAt: CREATED_AT,
    });
  });


  it("accepts a report without a description (the Zod schema makes it optional)", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository({
      findByUserAndActivity: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    const input = validInput({ description: undefined });
    const response = await service.createReport(ACTIVITY_ID, REPORTER_ID, input);


    expect(reportRepository.create).toHaveBeenCalledWith(
      ACTIVITY_ID,
      REPORTER_ID,
      input,
    );
    // description is nullish in the schema; the DTO exposes the null column.
    expect(response.description).toBeNull();
  });


  // ---------- Category pass-through (validation lives in the Zod layer) ----------


  it.each(REPORT_REASONS)(
    "accepts the %s category and forwards the data untouched",
    async (category) => {
      const activityRepository = mockActivityRepository({
        findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
      });
      const reportRepository = mockReportRepository({
        findByUserAndActivity: vi.fn().mockResolvedValue(null),
      });
      const service = new ActivityReportService({
        activityReportRepository: reportRepository,
        activityRepository,
      });


      const input = validInput({ category });
      const response = await service.createReport(ACTIVITY_ID, REPORTER_ID, input);


      expect(reportRepository.create).toHaveBeenCalledWith(
        ACTIVITY_ID,
        REPORTER_ID,
        input,
      );
      expect(response.category).toBe(category);
    },
  );


  it("forwards even a category the Zod contract would reject (detector test)", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository({
      findByUserAndActivity: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    // Today's behavior: category validation belongs to the Zod schema in the
    // controller, so the service forwards whatever it receives. If the rule
    // ever moves into the service, this test is the detector.
    const input = validInput({ category: "HARASSMENT" });
    const response = await service.createReport(ACTIVITY_ID, REPORTER_ID, input);


    expect(reportRepository.create).toHaveBeenCalledTimes(1);
    expect(response.category).toBe("HARASSMENT");
  });


  // ---------- Block 1: activityId format (ValidationError, 400) ----------


  it("rejects a malformed activity id with a ValidationError", async () => {
    const activityRepository = mockActivityRepository();
    const reportRepository = mockReportRepository();
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    await expectValidationError(
      service.createReport("not-a-uuid", REPORTER_ID, validInput()),
      [{ field: "id", message: "id must be a valid UUID." }],
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(reportRepository.findByUserAndActivity).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
  });


  it("rejects a well-formed non-v4 UUID (isValidUUID only accepts v4)", async () => {
    const activityRepository = mockActivityRepository();
    const reportRepository = mockReportRepository();
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    // Fixation: "a1b2...-1000-..." is a valid v1 UUID, but the project
    // convention accepts v4 only.
    await expectValidationError(
      service.createReport(
        "a1b2c3d4-0000-1000-8000-000000000001",
        REPORTER_ID,
        validInput(),
      ),
      [{ field: "id", message: "id must be a valid UUID." }],
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
  });


  it("accepts a boundary UUID whose version nibble is 4", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository({
      findByUserAndActivity: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    // Boundary of the version check: only the third group's first nibble
    // distinguishes a v4 UUID from a rejected one.
    const response = await service.createReport(
      "a1b2c3d4-0000-4fff-bfff-ffffffffffff",
      REPORTER_ID,
      validInput(),
    );


    expect(reportRepository.create).toHaveBeenCalledTimes(1);
    expect(response.activityId).toBe("a1b2c3d4-0000-4fff-bfff-ffffffffffff");
  });


  // ---------- Blocks 2-4: not found, own activity, duplicate (CustomError) ----------


  it("throws 404 when the activity does not exist", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(null),
    });
    const reportRepository = mockReportRepository();
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    // Also covers a soft-deleted activity: findById filters deletedAt, so both
    // cases reach the service as null (matches the Bruno "not found or deleted").
    await expectCustomError(
      service.createReport(ACTIVITY_ID, REPORTER_ID, validInput()),
      404,
      "Activity not found.",
    );
    expect(reportRepository.findByUserAndActivity).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
  });


  it("throws 403 when the author reports their own activity", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository();
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    await expectCustomError(
      service.createReport(ACTIVITY_ID, AUTHOR_ID, validInput()),
      403,
      "Activity authors cannot report their own activity.",
    );
    expect(reportRepository.findByUserAndActivity).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
  });


  it("throws 409 when the user has already reported the activity", async () => {
    const input = validInput();
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository({
      findByUserAndActivity: vi
        .fn()
        .mockResolvedValue(reportFactory(ACTIVITY_ID, REPORTER_ID, input)),
    });
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    await expectCustomError(
      service.createReport(ACTIVITY_ID, REPORTER_ID, input),
      409,
      "You have already reported this activity.",
    );
    expect(reportRepository.create).not.toHaveBeenCalled();
  });


  // ---------- Precedence between blocks ----------


  it("answers 403 when the author has also already reported (author check runs first)", async () => {
    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const reportRepository = mockReportRepository();
    const service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository,
    });


    // First-failure chain: when the reporter is the author, the duplicate
    // check must never run.
    await expectCustomError(
      service.createReport(ACTIVITY_ID, AUTHOR_ID, validInput()),
      403,
      "Activity authors cannot report their own activity.",
    );
    expect(reportRepository.findByUserAndActivity).not.toHaveBeenCalled();
  });


  // ---------- Repository failures propagate unchanged ----------


  it("propagates repository rejections unchanged (no wrapping)", async () => {
    const infraError = new Error("database is down");


    const failingFindById = mockActivityRepository({
      findById: vi.fn().mockRejectedValue(infraError),
    });
    const reportRepository = mockReportRepository();
    let service = new ActivityReportService({
      activityReportRepository: reportRepository,
      activityRepository: failingFindById,
    });
    await expect(
      service.createReport(ACTIVITY_ID, REPORTER_ID, validInput()),
    ).rejects.toBe(infraError);


    const activityRepository = mockActivityRepository({
      findById: vi.fn().mockResolvedValue(activityFrom(AUTHOR_ID)),
    });
    const failingFindDuplicate = mockReportRepository({
      findByUserAndActivity: vi.fn().mockRejectedValue(infraError),
    });
    service = new ActivityReportService({
      activityReportRepository: failingFindDuplicate,
      activityRepository,
    });
    await expect(
      service.createReport(ACTIVITY_ID, REPORTER_ID, validInput()),
    ).rejects.toBe(infraError);


    // A race between the duplicate check and create would surface here as a
    // Prisma P2002 (@@unique) — today it propagates as a 500 (contract debt);
    // a reporter deleted after login would surface as a P2003 FK violation
    // (ghost-user debt). Both keep propagating unchanged by design.
    const failingCreate = mockReportRepository({
      findByUserAndActivity: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(infraError),
    });
    service = new ActivityReportService({
      activityReportRepository: failingCreate,
      activityRepository,
    });
    await expect(
      service.createReport(ACTIVITY_ID, REPORTER_ID, validInput()),
    ).rejects.toBe(infraError);
  });
});
