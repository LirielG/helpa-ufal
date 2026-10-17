import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

// listActiveByUser only talks to the enrollment repository, so the other two
// are empty stand-ins. Empty `items` keeps the response mapping out of the way:
// these tests are about the pagination boundary only.
function setup() {
  const enrollmentRepository = {
    findActiveByUserId: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  } as unknown as IEnrollmentRepository;

  const service = new EnrollmentService({
    enrollmentRepository,
    activityRepository: {} as unknown as IActivityRepository,
    userRepository: {} as unknown as IUserRepository,
  });

  return { service, enrollmentRepository };
}

// Issue #248. listActiveByUser is public API of the service and converted
// page -> skip on its own, so it had the same trap as listParticipants:
// page 0 -> skip -10 -> a Prisma error surfacing as a 500.
describe("EnrollmentService.listActiveByUser — pagination boundary", () => {
  it("applies the defaults (page 1, limit 10) when page and limit are omitted", async () => {
    const { service, enrollmentRepository } = setup();

    const result = await service.listActiveByUser(USER_ID);

    expect(enrollmentRepository.findActiveByUserId).toHaveBeenCalledWith(
      USER_ID,
      0,
      10,
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10 });
  });

  it.each([
    { page: 1, limit: 10, skip: 0 },
    { page: 2, limit: 10, skip: 10 },
    { page: 3, limit: 50, skip: 100 },
  ])(
    "converts page $page / limit $limit into skip $skip / take $limit",
    async ({ page, limit, skip }) => {
      const { service, enrollmentRepository } = setup();

      const result = await service.listActiveByUser(USER_ID, page, limit);

      expect(enrollmentRepository.findActiveByUserId).toHaveBeenCalledWith(
        USER_ID,
        skip,
        limit,
      );
      expect(result).toMatchObject({ page, limit });
    },
  );

  it.each([
    { page: 0, expectedPage: 1 },
    { page: -1, expectedPage: 1 },
    { page: -100, expectedPage: 1 },
    { page: 2.7, expectedPage: 2 },
    { page: Number.NaN, expectedPage: 1 },
    { page: Number.POSITIVE_INFINITY, expectedPage: 1 },
  ])(
    "corrects the invalid page $page to $expectedPage: no negative skip reaches the repository",
    async ({ page, expectedPage }) => {
      const { service, enrollmentRepository } = setup();

      const result = await service.listActiveByUser(USER_ID, page, 10);

      expect(enrollmentRepository.findActiveByUserId).toHaveBeenCalledWith(
        USER_ID,
        (expectedPage - 1) * 10,
        10,
      );
      expect(result.page).toBe(expectedPage);
    },
  );

  it.each([
    { limit: 0, expectedLimit: 1 },
    { limit: -5, expectedLimit: 1 },
    { limit: 7.9, expectedLimit: 7 },
    { limit: Number.NaN, expectedLimit: 10 },
  ])(
    "corrects the invalid limit $limit to $expectedLimit",
    async ({ limit, expectedLimit }) => {
      const { service, enrollmentRepository } = setup();

      const result = await service.listActiveByUser(USER_ID, 3, limit);

      expect(enrollmentRepository.findActiveByUserId).toHaveBeenCalledWith(
        USER_ID,
        2 * expectedLimit,
        expectedLimit,
      );
      expect(result.limit).toBe(expectedLimit);
    },
  );

  it("never hands the repository a negative or fractional skip, nor a take below 1, for any page/limit", async () => {
    const { service, enrollmentRepository } = setup();
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
        await service.listActiveByUser(USER_ID, page, limit);
      }
    }

    const calls = vi.mocked(enrollmentRepository.findActiveByUserId).mock.calls;
    expect(calls).toHaveLength(values.length * values.length);
    for (const [, skip, take] of calls) {
      expect(Number.isInteger(skip)).toBe(true);
      expect(skip).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(take)).toBe(true);
      expect(take).toBeGreaterThanOrEqual(1);
    }
  });
});
