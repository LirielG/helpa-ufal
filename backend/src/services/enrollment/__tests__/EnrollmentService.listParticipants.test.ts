import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import {
  expectHttpError,
  expectCustomError,
  expectValidationError,
} from "@/utils/tests.js";

const AUTHOR_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OUTSIDER_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ACTIVITY_ID = "f26559ac-d672-4252-a9a4-d6fe6583d8ec";

// Shape produced by the repository's include: { user: { include: { student: true } } }.
// The passwordHash below is deliberately a sentry: the DTO mapping must drop it.
function aParticipant(overrides: Record<string, unknown> = {}) {
  const userId = randomUUID();
  return {
    id: randomUUID(),
    activityId: ACTIVITY_ID,
    userId,
    status: "APPROVED",
    attendanceConfirmed: null,
    confirmedWorkloadHours: 0,
    enrolledAt: new Date("2026-01-01T10:00:00.000Z"),
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    user: {
      id: userId,
      fullName: "Maria Clara Santos",
      email: "maria.santos@aluno.ufal.br",
      passwordHash: "super-secret-hash-that-must-never-leak",
      isManager: false,
      student: { registrationCode: "20240012345" },
    },
    ...overrides,
  };
}

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
    user?: Partial<IUserRepository>;
    enrollment?: Partial<IEnrollmentRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue({
      id: ACTIVITY_ID,
      authorId: AUTHOR_ID,
      status: "OPEN",
    }),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {
    findById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.user,
  } as unknown as IUserRepository;

  const enrollmentRepository = {
    findByActivityId: vi.fn().mockResolvedValue({
      items: [aParticipant()],
      total: 1,
      totalPresent: 0,
    }),
    ...overrides.enrollment,
  } as unknown as IEnrollmentRepository;

  return { activityRepository, userRepository, enrollmentRepository };
}

describe("EnrollmentService.listParticipants", () => {
  // ---------- Happy path ----------

  it("returns the mapped page to the activity author, with only the DTO fields", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const participant = aParticipant();
    enrollmentRepository.findByActivityId = vi
      .fn()
      .mockResolvedValue({ items: [participant], total: 1, totalPresent: 0 });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      AUTHOR_ID,
      ACTIVITY_ID,
      1,
      10,
    );

    expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
      ACTIVITY_ID,
      0,
      10,
    );
    expect(result).toEqual({
      items: [
        {
          id: participant.id,
          activityId: ACTIVITY_ID,
          userId: participant.user.id,
          status: "APPROVED",
          attendanceConfirmed: null,
          confirmedWorkloadHours: 0,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
          user: {
            id: participant.user.id,
            fullName: participant.user.fullName,
            email: participant.user.email,
            registrationCode: "20240012345",
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPresent: 0,
    });
    expect(result.items[0].user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(result)).not.toContain(
      "super-secret-hash-that-must-never-leak",
    );
  });

  it("returns the identical result to a manager who is not the author", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories({
        user: { findById: vi.fn().mockResolvedValue({ isManager: true }) },
      });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      OUTSIDER_ID,
      ACTIVITY_ID,
      1,
      10,
    );

    expect(result.total).toBe(1);
    expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
      ACTIVITY_ID,
      0,
      10,
    );
  });

  it("maps registrationCode from Student only: a professor (student = null) gets null", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const professor = aParticipant({
      user: {
        ...aParticipant().user,
        id: randomUUID(),
        fullName: "Prof. Ricardo Almeida",
        email: "ricardo.almeida@ufal.br",
        student: null,
      },
    });
    enrollmentRepository.findByActivityId = vi
      .fn()
      .mockResolvedValue({ items: [professor], total: 1, totalPresent: 0 });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      AUTHOR_ID,
      ACTIVITY_ID,
      1,
      10,
    );

    expect(result.items[0].user.registrationCode).toBeNull();
  });

  it("converts page/limit into skip/take for the repository (page 3, limit 50 -> skip 100)", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories({
        enrollment: {
          findByActivityId: vi
            .fn()
            .mockResolvedValue({ items: [], total: 42, totalPresent: 7 }),
        },
      });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      AUTHOR_ID,
      ACTIVITY_ID,
      3,
      50,
    );

    expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
      ACTIVITY_ID,
      100,
      50,
    );
    expect(result.total).toBe(42);
    expect(result.totalPresent).toBe(7);
  });

  it("trusts the repository's totalPresent — never recomputes it from workload hours", async () => {
    // Structurally impossible in production (hours are 0 unless presence is
    // confirmed), but the test pins the reading rule: the service forwards the
    // count instead of deriving it from confirmedWorkloadHours > 0.
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    enrollmentRepository.findByActivityId = vi.fn().mockResolvedValue({
      items: [
        aParticipant({ attendanceConfirmed: null, confirmedWorkloadHours: 4 }),
      ],
      total: 1,
      totalPresent: 0,
    });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      AUTHOR_ID,
      ACTIVITY_ID,
      1,
      10,
    );

    expect(result.totalPresent).toBe(0);
  });

  it("returns an empty page when the activity has no active enrollments (never 404)", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories({
        enrollment: {
          findByActivityId: vi
            .fn()
            .mockResolvedValue({ items: [], total: 0, totalPresent: 0 }),
        },
      });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    const result = await service.listParticipants(
      AUTHOR_ID,
      ACTIVITY_ID,
      1,
      10,
    );

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPresent: 0,
    });
  });

  // ---------- Pagination boundary ----------
  //
  // The repository speaks skip/take. The service owns the page -> skip
  // conversion AND the guard: the HTTP validateQuery is not the only caller,
  // so an invalid page/limit given to the service answers 400 instead of
  // building a negative skip (which Prisma rejects, surfacing as a 500).

  function aService() {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });
    return { service, enrollmentRepository };
  }

  it.each([
    { page: 1, limit: 10, skip: 0 },
    { page: 2, limit: 10, skip: 10 },
    { page: 3, limit: 50, skip: 100 },
  ])(
    "converts page $page / limit $limit into skip $skip / take $limit",
    async ({ page, limit, skip }) => {
      const { service, enrollmentRepository } = aService();

      const result = await service.listParticipants(
        AUTHOR_ID,
        ACTIVITY_ID,
        page,
        limit,
      );

      expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
        ACTIVITY_ID,
        skip,
        limit,
      );
      expect(result).toMatchObject({ page, limit });
    },
  );

  it("applies the defaults (page 1, limit 10) when page and limit are omitted", async () => {
    const { service, enrollmentRepository } = aService();

    const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID);

    expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
      ACTIVITY_ID,
      0,
      10,
    );
    expect(result).toMatchObject({ page: 1, limit: 10 });
  });

  it.each([
    0,
    -1,
    2.7,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])(
    "rejects page %s with 400 and never reaches the repository",
    async (page) => {
      const { service, enrollmentRepository } = aService();

      await expectValidationError(
        service.listParticipants(AUTHOR_ID, ACTIVITY_ID, page, 10),
        [{ field: "page", message: "page must be a positive integer." }],
      );
      expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
    },
  );

  it.each([0, -5, 7.9, Number.NaN])(
    "rejects limit %s with 400 and never reaches the repository",
    async (limit) => {
      const { service, enrollmentRepository } = aService();

      await expectValidationError(
        service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 3, limit),
        [{ field: "limit", message: "limit must be a positive integer." }],
      );
      expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
    },
  );

  it("reports both page and limit when both are invalid", async () => {
    const { service } = aService();

    await expectValidationError(
      service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 0, 0),
      [
        { field: "page", message: "page must be a positive integer." },
        { field: "limit", message: "limit must be a positive integer." },
      ],
    );
  });

  it("checks pagination only after authorization, so a 400 never leaks past a 403", async () => {
    const { service } = aService();

    await expectCustomError(
      service.listParticipants(OUTSIDER_ID, ACTIVITY_ID, 0, 10),
      403,
    );
  });

  it("never hands the repository a negative or fractional skip, nor a take below 1, for any page/limit", async () => {
    const { service, enrollmentRepository } = aService();
    const values = [
      -100,
      -1,
      0,
      0.5,
      1,
      2,
      3.5,
      10,
      50,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];

    for (const page of values) {
      for (const limit of values) {
        await service
          .listParticipants(AUTHOR_ID, ACTIVITY_ID, page, limit)
          .catch(() => undefined);
      }
    }

    const calls = vi.mocked(enrollmentRepository.findByActivityId).mock.calls;
    // Only page and limit in {1, 2, 10, 50} are valid.
    expect(calls).toHaveLength(16);
    for (const [, skip, take] of calls) {
      expect(Number.isInteger(skip)).toBe(true);
      expect(skip).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(take)).toBe(true);
      expect(take).toBeGreaterThanOrEqual(1);
    }
  });

  // ---------- Authentication (light hybrid) ----------

  it("throws 401 when the credential's user no longer exists, before touching the activity", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories({
        user: { findById: vi.fn().mockResolvedValue(null) },
      });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10),
      401,
      "User account not found or inactive.",
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
  });

  // ---------- Activity existence ----------

  it("throws 404 when the activity does not exist (or was soft-deleted)", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories({
        activity: { findById: vi.fn().mockResolvedValue(null) },
      });
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10),
      404,
      "Activity not found.",
    );
    expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
  });

  it("throws a plain 404 (not a ValidationError) for a malformed activityId", async () => {
    // Diverges from cancel(), which turns the same input into a 400:
    // this contract treats path identifiers as resource lookups.
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    await expectCustomError(
      service.listParticipants(AUTHOR_ID, "not-a-uuid", 1, 10),
      404,
      "Activity not found.",
    );
    expect(activityRepository.findById).not.toHaveBeenCalled();
    expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 for an authenticated user who is neither author nor manager, without querying enrollments", async () => {
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.listParticipants(OUTSIDER_ID, ACTIVITY_ID, 1, 10),
      403,
      "Only the activity creator or a manager can view the enrollment list.",
    );
    expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
  });

  it("throws 403 for a volunteer enrolled in the activity (enrollment grants no read access)", async () => {
    // Same code path as the outsider case — the criterion exists to pin that
    // being enrolled is NOT an authorization factor on this route.
    const { activityRepository, userRepository, enrollmentRepository } =
      mockRepositories();
    const service = new EnrollmentService({
      activityRepository,
      userRepository,
      enrollmentRepository,
    });

    await expectHttpError(
      service.listParticipants(OUTSIDER_ID, ACTIVITY_ID, 1, 10),
      403,
      "Only the activity creator or a manager can view the enrollment list.",
    );
    expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
  });
});
