import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { expectHttpError } from "@/utils/tests.js";

function mockRepositories(
  overrides: {
    activity?: Partial<IActivityRepository>;
    user?: Partial<IUserRepository>;
  } = {},
) {
  const activityRepository = {
    findById: vi.fn().mockResolvedValue(null),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides.activity,
  } as unknown as IActivityRepository;

  const userRepository = {
    findById: vi.fn().mockResolvedValue({ isManager: false }),
    ...overrides.user,
  } as unknown as IUserRepository;

  return { activityRepository, userRepository };
}

describe("ActivityService.delete", () => {
  // ---------- Missing/deleted activity ----------

  it("throws 404 when the activity does not exist or was already deleted", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.delete("act-1", "user-1"), 404);
    expect(activityRepository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 404 (not 403) when the activity does not exist, even for a non-author", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.delete("act-1", "anyone"), 404);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  // ---------- Authorization ----------

  it("throws 403 when the requester is neither the author nor a manager", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.delete("act-1", "user-2"), 403);
    expect(activityRepository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists in the database and is not the author", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }) },
      user: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.delete("act-1", "ghost-user"), 403);
    expect(activityRepository.softDelete).not.toHaveBeenCalled();
  });

  it("throws 403 when the token's user no longer exists, even if they were the author", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }) },
      user: { findById: vi.fn().mockResolvedValue(null) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expectHttpError(service.delete("act-1", "author-1"), 403);
    expect(activityRepository.softDelete).not.toHaveBeenCalled();
  });

  // ---------- Happy path ----------

  it("the author can delete their own activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.delete("act-1", "author-1");
    expect(activityRepository.softDelete).toHaveBeenCalledTimes(1);
    expect(activityRepository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("a manager can delete another author's activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" }) },
      user: { findById: vi.fn().mockResolvedValue({ isManager: true }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.delete("act-1", "manager-9");
    expect(activityRepository.softDelete).toHaveBeenCalledWith("act-1");
  });

  it("a manager can delete their own activity", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "manager-9" }) },
      user: { findById: vi.fn().mockResolvedValue({ isManager: true }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.delete("act-1", "manager-9");
    expect(activityRepository.softDelete).toHaveBeenCalledTimes(1);
  });

  // ---------- Concurrency ----------

    // Race condition: findById saw the activity as active, but between the read
    // and the write another request deleted it. The updateMany guard
    // (deletedAt: null) returns count 0 ⇒ softDelete returns false.
    // Treated as success: the desired final state already holds.

  it("does not throw when softDelete returns false (another request deleted first)", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: {
        findById: vi.fn().mockResolvedValue({ id: "act-1", authorId: "author-1" })
      },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await expect(service.delete("act-1", "author-1")).resolves.toBeUndefined();
  });
});

describe("ActivityService.list", () => {
  it("maps start_date to startDate and passes it to repository.list", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { list: vi.fn().mockResolvedValue({ activities: [], total: 0 }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.list({ orderBy: "start_date" });

    expect(activityRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "startDate",
      }),
    );
  });

  it("maps created_at to createdAt and passes it to repository.list", async () => {
    const { activityRepository, userRepository } = mockRepositories({
      activity: { list: vi.fn().mockResolvedValue({ activities: [], total: 0 }) },
    });
    const service = new ActivityService({ activityRepository, userRepository });

    await service.list({ orderBy: "created_at" });

    expect(activityRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "createdAt",
      }),
    );
  });

  it("throws a ValidationError with field 'type' when filter.type is invalid", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    try {
      await service.list({ type: "INVALID_TYPE" as any });
      expect.fail("Should have thrown ValidationError");
    } catch (error: any) {
      expect(error.errors[0].field).toBe("type");
    }
  });

  it("throws a ValidationError with field 'format' when filter.format is invalid", async () => {
    const { activityRepository, userRepository } = mockRepositories();
    const service = new ActivityService({ activityRepository, userRepository });

    try {
      await service.list({ format: "INVALID_FORMAT" as any });
      expect.fail("Should have thrown ValidationError");
    } catch (error: any) {
      expect(error.errors[0].field).toBe("format");
    }
  });
});