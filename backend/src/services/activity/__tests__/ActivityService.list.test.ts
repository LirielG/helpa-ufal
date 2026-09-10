import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findUserById: vi.fn().mockResolvedValue({ isManager: false }),
    softDelete: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    ...overrides,
  } as unknown as IActivityRepository;
}

describe("ActivityService.list", () => {
  it("maps start_date to startDate and passes it to repository.list", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "start_date" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "startDate",
      }),
    );
  });

  it("maps created_at to createdAt and passes it to repository.list", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "created_at" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "createdAt",
      }),
    );
  });

  it("throws a ValidationError with status 400 and field 'type' when filter.type is invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expect(
      service.list({ type: "INVALID_TYPE" as any }),
    ).rejects.toSatisfy((error: any) => {
      expect(error.statusCode ?? error.status).toBe(400);
      expect(error.errors?.[0]?.field).toBe("type");
      return true;
    });
  });

  it("throws a ValidationError with status 400 and field 'format' when filter.format is invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expect(
      service.list({ format: "INVALID_FORMAT" as any }),
    ).rejects.toSatisfy((error: any) => {
      expect(error.statusCode ?? error.status).toBe(400);
      expect(error.errors?.[0]?.field).toBe("format");
      return true;
    });
  });
});