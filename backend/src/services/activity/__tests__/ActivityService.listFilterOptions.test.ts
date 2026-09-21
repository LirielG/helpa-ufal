import { describe, it, expect, vi } from "vitest";
import ActivityService from "../ActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    listDistinctAreas: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IActivityRepository;
}

describe("ActivityService.listFilterOptions", () => {
  it("returns the repository's distinct areas under the `areas` key", async () => {
    const repository = mockRepository({
      listDistinctAreas: vi.fn().mockResolvedValue(["Educação", "Saúde"]),
    });
    const service = new ActivityService({ activityRepository: repository });

    const options = await service.listFilterOptions();

    expect(options).toEqual({ areas: ["Educação", "Saúde"] });
    expect(repository.listDistinctAreas).toHaveBeenCalledOnce();
  });
});
