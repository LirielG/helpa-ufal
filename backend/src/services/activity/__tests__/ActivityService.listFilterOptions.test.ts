// backend/src/services/activity/__tests__/ActivityService.listFilterOptions.test.ts
//
// Unit spec for the new service method (#158, step 2). Mirrors the SIGAA
// precedent (SigaaActivityService.listFilterOptions.test.ts), which exists to
// guard a behaviour — there, "never triggers a sync"; here, the pass-through
// and the response key.
//
// Red here is a COMPILE error (`listFilterOptions` and `listDistinctAreas` do
// not exist yet). That is the expected starting point: the test goes green in
// step 3 without edits.

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
