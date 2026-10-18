import { describe, it, expect, vi } from "vitest";
import UserService from "../UserService.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import { expectCustomError } from "@/utils/tests.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function mockUserRepository(user: unknown) {
  return {
    findById: vi.fn().mockResolvedValue(user),
  } as unknown as IUserRepository;
}

function mockActivityRepository(items: unknown[] = [], total = items.length) {
  return {
    listByUser: vi.fn().mockResolvedValue({ items, total }),
  } as unknown as IActivityRepository;
}

describe("UserService.listActivities", () => {
  it("asks the repository for the token owner's page and wraps it in the envelope", async () => {
    const activityRepository = mockActivityRepository(
      [{ id: "a" }, { id: "b" }],
      5,
    );
    const service = new UserService({
      userRepository: mockUserRepository({ isManager: false }),
      activityRepository,
    });

    const result = await service.listActivities(USER_ID, {
      filter: "managed",
      page: 2,
      limit: 2,
    });

    expect(activityRepository.listByUser).toHaveBeenCalledExactlyOnceWith(
      USER_ID,
      "managed",
      2,
      2,
    );
    expect(result).toEqual({
      items: [{ id: "a" }, { id: "b" }],
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
    });
  });

  it("reports one page for an empty history", async () => {
    const service = new UserService({
      userRepository: mockUserRepository({ isManager: false }),
      activityRepository: mockActivityRepository(),
    });

    const result = await service.listActivities(USER_ID, {
      filter: "enrolled",
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it("fails with 404 without querying activities when the user does not exist", async () => {
    const activityRepository = mockActivityRepository();
    const service = new UserService({
      userRepository: mockUserRepository(null),
      activityRepository,
    });

    await expectCustomError(
      service.listActivities(USER_ID, {
        filter: "enrolled",
        page: 1,
        limit: 20,
      }),
      404,
      "User not found.",
    );
    expect(activityRepository.listByUser).not.toHaveBeenCalled();
  });
});
