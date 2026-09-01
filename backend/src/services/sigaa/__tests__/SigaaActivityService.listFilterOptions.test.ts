import { describe, it, expect, vi } from "vitest";
import SigaaActivityService from "../SigaaActivityService.js";
import type { ISigaaSyncService } from "../ISigaaSyncService.js";
import type { ISigaaActivityRepository } from "@/repositories/sigaa/ISigaaActivityRepository.js";

function mockRepository(
  overrides: Partial<ISigaaActivityRepository> = {},
): ISigaaActivityRepository {
  return {
    getLatestLastSeenAt: vi.fn().mockResolvedValue(null),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    markInactiveBefore: vi.fn().mockResolvedValue(0),
    list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    listDistinctTypes: vi.fn().mockResolvedValue([]),
    listDistinctDepartments: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ISigaaActivityRepository;
}

function mockSyncService(): ISigaaSyncService {
  return {
    syncIfNeeded: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISigaaSyncService;
}

describe("SigaaActivityService.listFilterOptions", () => {
  // The filter options must be servable while SIGAA is down: they describe what
  // is already persisted, and they are needed before the first listing request.
  it("never triggers a sync", async () => {
    const repository = mockRepository({
      listDistinctTypes: vi.fn().mockResolvedValue(["CURSO"]),
      listDistinctDepartments: vi.fn().mockResolvedValue(["CEDU"]),
    });
    const syncService = mockSyncService();
    const service = new SigaaActivityService({
      sigaaActivityRepository: repository,
      sigaaSyncService: syncService,
    });

    const options = await service.listFilterOptions();

    expect(options).toEqual({ types: ["CURSO"], departments: ["CEDU"] });
    expect(syncService.syncIfNeeded).not.toHaveBeenCalled();
    expect(syncService.forceSync).not.toHaveBeenCalled();
  });
});
