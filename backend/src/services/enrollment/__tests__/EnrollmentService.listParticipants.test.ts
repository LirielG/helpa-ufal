import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { expectHttpError, expectCustomError } from "@/utils/tests.js";

const AUTHOR_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OUTSIDER_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ACTIVITY_ID = "f26559ac-d672-4252-a9a4-d6fe6583d8ec";

// Shape produced by the repository's include: { user: { include: { student: true } } }.
// The passwordHash below is deliberately a sentry: the DTO mapping must drop it.
function aParticipant(overrides: Record<string, unknown> = {}) {
    const userId = randomUUID();
    return {
        id: randomUUID(),
        userId,
        status: "APPROVED",
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
        enrolledAt: new Date("2026-01-01T10:00:00.000Z"),
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
        enrollment?: Partial<IEnrollmentRepository>;
    } = {},
) {
    const activityRepository = {
        findById: vi
            .fn()
            .mockResolvedValue({ id: ACTIVITY_ID, authorId: AUTHOR_ID, status: "OPEN" }),
        findUserById: vi.fn().mockResolvedValue({ isManager: false }),
        ...overrides.activity,
    } as unknown as IActivityRepository;

    const enrollmentRepository = {
        findByActivityId: vi
            .fn()
            .mockResolvedValue({ items: [aParticipant()], total: 1, totalPresent: 0 }),
        ...overrides.enrollment,
    } as unknown as IEnrollmentRepository;

    return { activityRepository, enrollmentRepository };
}

describe("EnrollmentService.listParticipants", () => {
    // ---------- Happy path ----------

    it("returns the mapped page to the activity author, with only the DTO fields", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories();
        const participant = aParticipant();
        enrollmentRepository.findByActivityId = vi
            .fn()
            .mockResolvedValue({ items: [participant], total: 1, totalPresent: 0 });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10);

        expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
            ACTIVITY_ID,
            1,
            10,
        );
        expect(result).toEqual({
            items: [
                {
                    enrollmentId: participant.id,
                    userId: participant.user.id,
                    fullName: participant.user.fullName,
                    email: participant.user.email,
                    registrationCode: "20240012345",
                    status: "APPROVED",
                    attendanceConfirmed: null,
                    confirmedWorkloadHours: 0,
                },
            ],
            total: 1,
            page: 1,
            limit: 10,
            totalPresent: 0,
        });
        expect(result.items[0]).not.toHaveProperty("passwordHash");
        expect(JSON.stringify(result)).not.toContain("super-secret-hash-that-must-never-leak");
    });

    it("returns the identical result to a manager who is not the author", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories({
            activity: { findUserById: vi.fn().mockResolvedValue({ isManager: true }) },
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(OUTSIDER_ID, ACTIVITY_ID, 1, 10);

        expect(result.total).toBe(1);
        expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
            ACTIVITY_ID,
            1,
            10,
        );
    });

    it("maps registrationCode from Student only: a professor (student = null) gets null", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories();
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
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10);

        expect(result.items[0].registrationCode).toBeNull();
    });

    it("passes pagination through to the repository unchanged", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories({
            enrollment: {
                findByActivityId: vi
                    .fn()
                    .mockResolvedValue({ items: [], total: 42, totalPresent: 7 }),
            },
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 3, 50);

        expect(enrollmentRepository.findByActivityId).toHaveBeenCalledWith(
            ACTIVITY_ID,
            3,
            50,
        );
        expect(result.total).toBe(42);
        expect(result.totalPresent).toBe(7);
    });

    it("trusts the repository's totalPresent — never recomputes it from workload hours", async () => {
        // Structurally impossible in production (hours are 0 unless presence is
        // confirmed), but the test pins the reading rule: the service forwards the
        // count instead of deriving it from confirmedWorkloadHours > 0.
        const { activityRepository, enrollmentRepository } = mockRepositories();
        enrollmentRepository.findByActivityId = vi.fn().mockResolvedValue({
            items: [aParticipant({ attendanceConfirmed: null, confirmedWorkloadHours: 4 })],
            total: 1,
            totalPresent: 0,
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10);

        expect(result.totalPresent).toBe(0);
    });

    it("returns an empty page when the activity has no active enrollments (never 404)", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories({
            enrollment: {
                findByActivityId: vi
                    .fn()
                    .mockResolvedValue({ items: [], total: 0, totalPresent: 0 }),
            },
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        const result = await service.listParticipants(AUTHOR_ID, ACTIVITY_ID, 1, 10);

        expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10, totalPresent: 0 });
    });

    // ---------- Authentication (light hybrid) ----------

    it("throws 401 when the credential's user no longer exists, before touching the activity", async () => {
        const { activityRepository, enrollmentRepository } = mockRepositories({
            activity: { findUserById: vi.fn().mockResolvedValue(null) },
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

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
        const { activityRepository, enrollmentRepository } = mockRepositories({
            activity: { findById: vi.fn().mockResolvedValue(null) },
        });
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

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
        const { activityRepository, enrollmentRepository } = mockRepositories();
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

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
        const { activityRepository, enrollmentRepository } = mockRepositories();
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

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
        const { activityRepository, enrollmentRepository } = mockRepositories();
        const service = new EnrollmentService({ activityRepository, enrollmentRepository });

        await expectHttpError(
            service.listParticipants(OUTSIDER_ID, ACTIVITY_ID, 1, 10),
            403,
            "Only the activity creator or a manager can view the enrollment list.",
        );
        expect(enrollmentRepository.findByActivityId).not.toHaveBeenCalled();
    });
});
