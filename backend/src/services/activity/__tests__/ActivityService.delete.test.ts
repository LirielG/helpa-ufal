import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { expectHttpError } from "@/utils/tests.js";

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as IActivityRepository;
}

function mockUserRepository(
  overrides: Partial<IUserRepository> = {},
): IUserRepository {
  return {
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    findByEmail: vi.fn(),
    createWithSubtype: vi.fn(),
    ...overrides,
  } as unknown as IUserRepository;
}


describe("ActivityService.delete", () => {
  it("throws 404 when the activity does not exist or was already deleted", async () => {
    const repository = mockRepository();
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expectHttpError(service.delete("act-1", "user-1"), 404);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 404 (not 403) when the activity does not exist, even for a non-author", async () => {
    const repository = mockRepository();
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expectHttpError(service.delete("act-1", "anyone"), 404);
    expect(userRepository.findUserById).not.toHaveBeenCalled();
  });

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expectHttpError(service.delete("act-1", "user-2"), 403);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists in the database and is not the author", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const userRepository = mockUserRepository({
      findUserById: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expectHttpError(service.delete("act-1", "ghost-user"), 403);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists, even if they were the author", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const userRepository = mockUserRepository({
      findUserById: vi.fn().mockResolvedValue(null),
    });
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expectHttpError(service.delete("act-1", "author-1"), 403);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it("the author can delete their own activity", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await service.delete("act-1", "author-1");
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
    expect(repository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("a manager can delete another author's activity", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
    });
    const userRepository = mockUserRepository({
      findUserById: vi.fn().mockResolvedValue({ isManager: true }),
    });
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await service.delete("act-1", "manager-9");
    expect(repository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("a manager can delete their own activity", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "manager-9" }),
    });
    const userRepository = mockUserRepository({
      findUserById: vi.fn().mockResolvedValue({ isManager: true }),
    });
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await service.delete("act-1", "manager-9");
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
  });

  it("does not throw when softDelete returns false (another request deleted first)", async () => {
    const repository = mockRepository({
      findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }),
      softDelete: vi.fn().mockResolvedValue(false),
    });
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await expect(service.delete("act-1", "author-1")).resolves.toBeUndefined();
  });
});

describe("ActivityService.list", () => {
  it("maps start_date to startDate and passes it to repository.list", async () => {
    const repository = mockRepository({
      list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    });
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await service.list({ orderBy: "start_date" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "startDate",
      }),
    );
  });

  it("maps created_at to createdAt and passes it to repository.list", async () => {
    const repository = mockRepository({
      list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    });
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    await service.list({ orderBy: "created_at" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "createdAt",
      }),
    );
  });

  it("throws a ValidationError with field 'type' when filter.type is invalid", async () => {
    const repository = mockRepository();
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    try {
      await service.list({ type: "INVALID_TYPE" as any });
      expect.fail("Should have thrown ValidationError");
    } catch (error: any) {
      expect(error.errors[0].field).toBe("type");
    }
  });

  it("throws a ValidationError with field 'format' when filter.format is invalid", async () => {
    const repository = mockRepository();
    const userRepository = mockUserRepository();
    const service = new ActivityService({ activityRepository: repository, userRepository });

    try {
      await service.list({ format: "INVALID_FORMAT" as any });
      expect.fail("Should have thrown ValidationError");
    } catch (error: any) {
      expect(error.errors[0].field).toBe("format");
    }
  });
});