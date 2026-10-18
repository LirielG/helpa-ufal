import { describe, it, expect, vi } from "vitest";
import EnrollmentService from "../EnrollmentService.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { expectValidationError } from "@/utils/tests.js";

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

// listActiveByUser is public API of the service and used to convert
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
    0,
    -1,
    2.7,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])(
    "rejects page %s with 400 and never reaches the repository",
    async (page) => {
      const { service, enrollmentRepository } = setup();

      await expectValidationError(service.listActiveByUser(USER_ID, page, 10), [
        { field: "page", message: "page must be a positive integer." },
      ]);
      expect(enrollmentRepository.findActiveByUserId).not.toHaveBeenCalled();
    },
  );

  it.each([0, -5, 7.9, Number.NaN])(
    "rejects limit %s with 400 and never reaches the repository",
    async (limit) => {
      const { service, enrollmentRepository } = setup();

      await expectValidationError(service.listActiveByUser(USER_ID, 3, limit), [
        { field: "limit", message: "limit must be a positive integer." },
      ]);
      expect(enrollmentRepository.findActiveByUserId).not.toHaveBeenCalled();
    },
  );
});
