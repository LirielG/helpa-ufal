import { describe, it, expect, vi, beforeEach } from "vitest";
import SigaaSyncService from "../SigaaSyncService.js";
import type { ISigaaScraperService } from "../ISigaaScraperService.js";
import type { ISigaaActivityRepository } from "@/repositories/sigaa/ISigaaActivityRepository.js";
import type { SigaaActivity } from "@prisma/client";

function mockScraper(overrides: Partial<ISigaaScraperService> = {}): ISigaaScraperService {
  return {
    scrapeCurrentYearActivities: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockRepository(overrides: Partial<ISigaaActivityRepository> = {}): ISigaaActivityRepository {
  return {
    getLatestLastSeenAt: vi.fn().mockResolvedValue(null),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    markInactiveBefore: vi.fn().mockResolvedValue(0),
    list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    listDistinctDepartments: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ISigaaActivityRepository;
}

describe("SigaaSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncIfNeeded — failure handling", () => {
    it("does not throw when scraper fails with network error", async () => {
      const scraper = mockScraper({
        scrapeCurrentYearActivities: vi.fn().mockRejectedValue(new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE")),
      });
      const repository = mockRepository();
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 0,
      });

      await expect(syncService.syncIfNeeded()).resolves.toBeUndefined();
    });

    it("does not throw when scraper fails with timeout", async () => {
      const scraper = mockScraper({
        scrapeCurrentYearActivities: vi.fn().mockRejectedValue(new Error("The operation was aborted")),
      });
      const repository = mockRepository();
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 0,
      });

      await expect(syncService.syncIfNeeded()).resolves.toBeUndefined();
    });

    it("does not upsert when scraper fails", async () => {
      const scraper = mockScraper({
        scrapeCurrentYearActivities: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      });
      const repository = mockRepository();
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 0,
      });

      await syncService.syncIfNeeded();
      expect(repository.upsertMany).not.toHaveBeenCalled();
    });

    it("still returns existing data from repository when scraper fails", async () => {
      const existingActivities: SigaaActivity[] = [
        {
          id: "1",
          sigaaId: "100",
          title: "Existing Activity",
          type: "CURSO",
          normalizedType: "COURSE",
          department: "DEPT",
          isActive: true,
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const scraper = mockScraper({
        scrapeCurrentYearActivities: vi.fn().mockRejectedValue(new Error("fetch failed")),
      });
      const repository = mockRepository({
        list: vi.fn().mockResolvedValue({ activities: existingActivities, total: 1 }),
      });
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 0,
      });

      await syncService.syncIfNeeded();
      const result = await repository.list({
        search: undefined,
        type: undefined,
        department: undefined,
        page: 1,
        limit: 10,
        orderBy: "lastSeenAt",
        order: "desc",
      });

      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].title).toBe("Existing Activity");
    });
  });

  describe("syncIfNeeded — cache valid", () => {
    it("does not scrape when cache is still valid", async () => {
      const scraper = mockScraper();
      const repository = mockRepository({
        getLatestLastSeenAt: vi.fn().mockResolvedValue(new Date()),
      });
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 60 * 60 * 1000,
      });

      await syncService.syncIfNeeded();
      expect(scraper.scrapeCurrentYearActivities).not.toHaveBeenCalled();
    });
  });

  describe("forceSync — concurrency", () => {
    it("does not trigger two scrapings for concurrent calls", async () => {
      let callCount = 0;
      const scraper = mockScraper({
        scrapeCurrentYearActivities: vi.fn().mockImplementation(async () => {
          callCount++;
          await new Promise((r) => setTimeout(r, 50));
          return [];
        }),
      });
      const repository = mockRepository();
      const syncService = new SigaaSyncService({
        scraperService: scraper,
        activityRepository: repository,
        cacheTtlMs: 0,
      });

      await Promise.all([syncService.forceSync(), syncService.forceSync()]);
      expect(callCount).toBe(1);
    });
  });
});
