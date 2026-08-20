import { describe, it, expect, vi } from "vitest";
import FeedService from "../FeedService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { ISigaaActivityRepository } from "@/repositories/activity/sigaa/ISigaaActivityRepository.js";
import type { ISigaaSyncService } from "@/services/activity/sigaa/ISigaaSyncService.js";
import type { ActivityResponse } from "@/types/activity.js";
import type { SigaaActivity } from "@prisma/client";
import { SIGAA_PUBLIC_SEARCH_URL } from "@/services/activity/sigaa/SigaaScraperService.js";
import ValidationError from "@/models/error/ValidationError.js";

function makeLocalActivity(overrides: Partial<ActivityResponse> = {}): ActivityResponse {
  return {
    id: "local-act-1",
    authorId: "user-1",
    title: "Ação Local 1",
    type: "EVENT",
    campus: "ARAPIRACA",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-02"),
    slots: 50,
    availableSlots: 20,
    status: "OPEN",
    ...overrides,
  };
}

function makeSigaaActivity(overrides: Partial<SigaaActivity> = {}): SigaaActivity {
  return {
    id: "sigaa-act-1",
    sigaaId: "12345",
    title: "2026 - AÇÃO SIGAA 1",
    type: "CURSO",
    normalizedType: "COURSE",
    department: "ICHCA",
    isActive: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMocks(overrides?: {
  localActivities?: ActivityResponse[];
  localTotal?: number;
  sigaaActivities?: SigaaActivity[];
  sigaaTotal?: number;
}) {
  const mockActivityRepository: IActivityRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn().mockResolvedValue({
      activities: overrides?.localActivities ?? [makeLocalActivity()],
      total: overrides?.localTotal ?? 1,
    }),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findUserById: vi.fn(),
    countApprovedEnrollments: vi.fn(),
  };

  const mockSigaaActivityRepository: ISigaaActivityRepository = {
    getLatestLastSeenAt: vi.fn().mockResolvedValue(new Date()),
    upsertMany: vi.fn(),
    markInactiveBefore: vi.fn(),
    list: vi.fn().mockResolvedValue({
      activities: overrides?.sigaaActivities ?? [makeSigaaActivity()],
      total: overrides?.sigaaTotal ?? 1,
    }),
  };

  const mockSigaaSyncService: ISigaaSyncService = {
    syncIfNeeded: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
  };

  const feedService = new FeedService({
    activityRepository: mockActivityRepository,
    sigaaActivityRepository: mockSigaaActivityRepository,
    sigaaSyncService: mockSigaaSyncService,
  });

  return { feedService, mockActivityRepository, mockSigaaActivityRepository, mockSigaaSyncService };
}

describe("FeedService", () => {
  it("should return unified feed and omit SIGAA-unsupported fields", async () => {
    const { feedService, mockSigaaSyncService } = buildMocks();

    const result = await feedService.getFeed({});

    expect(mockSigaaSyncService.syncIfNeeded).toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);

    const localItem = result.items.find((item) => item.source === "LOCAL");
    expect(localItem).toBeDefined();
    expect(localItem?.authorId).toBe("user-1");
    expect(localItem?.campus).toBe("ARAPIRACA");
    expect(localItem?.slots).toBe(50);
    expect(localItem?.availableSlots).toBe(20);
    expect(localItem?.status).toBe("OPEN");

    const sigaaItem = result.items.find((item) => item.source === "SIGAA");
    expect(sigaaItem).toBeDefined();
    expect(sigaaItem?.id).toBe("sigaa-act-1");
    expect(sigaaItem?.title).toBe("2026 - AÇÃO SIGAA 1");
    expect(sigaaItem?.type).toBe("COURSE");
    expect(sigaaItem?.originalType).toBe("CURSO");
    expect(sigaaItem?.department).toBe("ICHCA");
    expect(sigaaItem?.url).toBe(SIGAA_PUBLIC_SEARCH_URL);

    // SIGAA items should NOT have these fields
    expect(sigaaItem?.status).toBeUndefined();
    expect(sigaaItem?.authorId).toBeUndefined();
    expect(sigaaItem?.campus).toBeUndefined();
    expect(sigaaItem?.startDate).toBeUndefined();
    expect(sigaaItem?.endDate).toBeUndefined();
    expect(sigaaItem?.slots).toBeUndefined();
    expect(sigaaItem?.availableSlots).toBeUndefined();
  });

  describe("filter validation", () => {
    it("should throw 400 for invalid status", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ status: "INVALID" }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "status"),
        );
    });

    it("should throw 400 for invalid format", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ format: "WRONG" }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "format"),
        );
    });

    it("should throw 400 for invalid type", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ type: "WRONG" }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "type"),
        );
    });

    it("should throw 400 for invalid orderBy", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ orderBy: "invalid_field" }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "orderBy"),
        );
    });

    it("should throw 400 for invalid order", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ order: "random" }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "order"),
        );
    });

    it("should throw 400 for invalid source", async () => {
      const { feedService } = buildMocks();
      await expect(feedService.getFeed({ source: "REMOTE" as any }))
        .rejects.toSatisfy((err: ValidationError) =>
          err.errors.some((e) => e.field === "source"),
        );
    });

    it("should accept valid filter values without errors", async () => {
      const { feedService } = buildMocks();
      const result = await feedService.getFeed({
        status: "OPEN",
        format: "ONLINE",
        type: "COURSE",
        orderBy: "title",
        order: "asc",
        source: "ALL",
      });
      expect(result).toBeDefined();
    });
  });

  describe("SIGAA exclusion by filters", () => {
    it("should exclude SIGAA when campus is provided", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      const result = await feedService.getFeed({ campus: "ARAPIRACA" });

      expect(mockSigaaActivityRepository.list).not.toHaveBeenCalled();
      expect(result.items.every((item) => item.source === "LOCAL")).toBe(true);
    });

    it("should exclude SIGAA when format is provided", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      const result = await feedService.getFeed({ format: "ONLINE" });

      expect(mockSigaaActivityRepository.list).not.toHaveBeenCalled();
      expect(result.items.every((item) => item.source === "LOCAL")).toBe(true);
    });

    it("should exclude SIGAA when status is OPEN", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      const result = await feedService.getFeed({ status: "OPEN" });

      expect(mockSigaaActivityRepository.list).not.toHaveBeenCalled();
      expect(result.items.every((item) => item.source === "LOCAL")).toBe(true);
    });

    it("should exclude SIGAA when status is COMPLETED", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      const result = await feedService.getFeed({ status: "COMPLETED" });

      expect(mockSigaaActivityRepository.list).not.toHaveBeenCalled();
      expect(result.items.every((item) => item.source === "LOCAL")).toBe(true);
    });

    it("should NOT exclude SIGAA when only type filter is used", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      await feedService.getFeed({ type: "COURSE" });

      expect(mockSigaaActivityRepository.list).toHaveBeenCalled();
    });

    it("should NOT exclude SIGAA when only search filter is used", async () => {
      const { feedService, mockSigaaActivityRepository } = buildMocks();

      await feedService.getFeed({ search: "python" });

      expect(mockSigaaActivityRepository.list).toHaveBeenCalled();
    });
  });

  describe("source=SIGAA with incompatible filters", () => {
    it("should return empty when source=SIGAA and campus is provided", async () => {
      const { feedService } = buildMocks();

      const result = await feedService.getFeed({ source: "SIGAA", campus: "ARAPIRACA" });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return empty when source=SIGAA and format is provided", async () => {
      const { feedService } = buildMocks();

      const result = await feedService.getFeed({ source: "SIGAA", format: "ONLINE" });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return empty when source=SIGAA and status is provided", async () => {
      const { feedService } = buildMocks();

      const result = await feedService.getFeed({ source: "SIGAA", status: "OPEN" });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return SIGAA results when source=SIGAA with type filter", async () => {
      const { feedService } = buildMocks();

      const result = await feedService.getFeed({ source: "SIGAA", type: "COURSE" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].source).toBe("SIGAA");
    });
  });

  describe("sorting", () => {
    it("should sort by title ascending", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "b", title: "Alpha" }),
          makeLocalActivity({ id: "a", title: "Zebra" }),
        ],
        localTotal: 2,
        sigaaActivities: [],
        sigaaTotal: 0,
      });

      const result = await feedService.getFeed({ orderBy: "title", order: "asc" });

      expect(result.items[0].title).toBe("Alpha");
      expect(result.items[1].title).toBe("Zebra");
    });

    it("should sort by title descending", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "b", title: "Zebra" }),
          makeLocalActivity({ id: "a", title: "Alpha" }),
        ],
        localTotal: 2,
        sigaaActivities: [],
        sigaaTotal: 0,
      });

      const result = await feedService.getFeed({ orderBy: "title", order: "desc" });

      expect(result.items[0].title).toBe("Zebra");
      expect(result.items[1].title).toBe("Alpha");
    });

    it("should sort by type ascending", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "b", title: "Course", type: "COURSE" }),
          makeLocalActivity({ id: "a", title: "Event", type: "EVENT" }),
        ],
        localTotal: 2,
        sigaaActivities: [],
        sigaaTotal: 0,
      });

      const result = await feedService.getFeed({ orderBy: "type", order: "asc" });

      expect(result.items[0].type).toBe("COURSE");
      expect(result.items[1].type).toBe("EVENT");
    });

    it("should merge-sort across sources by title", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "l1", title: "Charlie" }),
          makeLocalActivity({ id: "l2", title: "Echo" }),
        ],
        localTotal: 2,
        sigaaActivities: [
          makeSigaaActivity({ id: "s1", title: "Alpha" }),
          makeSigaaActivity({ id: "s2", title: "Delta" }),
        ],
        sigaaTotal: 2,
      });

      const result = await feedService.getFeed({ orderBy: "title", order: "asc" });

      expect(result.items.map((i) => i.title)).toEqual([
        "Alpha",
        "Charlie",
        "Delta",
        "Echo",
      ]);
    });
  });

  describe("merge (source=ALL)", () => {
    it("should merge local and SIGAA items sorted by title", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "l1", title: "Bravo" }),
          makeLocalActivity({ id: "l2", title: "Delta" }),
        ],
        localTotal: 2,
        sigaaActivities: [
          makeSigaaActivity({ id: "s1", title: "Alpha" }),
          makeSigaaActivity({ id: "s2", title: "Charlie" }),
        ],
        sigaaTotal: 2,
      });

      const result = await feedService.getFeed({ orderBy: "title", order: "asc" });

      expect(result.items).toHaveLength(4);
      expect(result.items.map((i) => i.title)).toEqual([
        "Alpha",
        "Bravo",
        "Charlie",
        "Delta",
      ]);
    });

    it("should handle uneven lists", async () => {
      const { feedService } = buildMocks({
        localActivities: [
          makeLocalActivity({ id: "l1", title: "Bravo" }),
          makeLocalActivity({ id: "l2", title: "Echo" }),
          makeLocalActivity({ id: "l3", title: "Foxtrot" }),
        ],
        localTotal: 3,
        sigaaActivities: [
          makeSigaaActivity({ id: "s1", title: "Alpha" }),
        ],
        sigaaTotal: 1,
      });

      const result = await feedService.getFeed({ orderBy: "title", order: "asc" });

      expect(result.items).toHaveLength(4);
      expect(result.items.map((i) => i.title)).toEqual([
        "Alpha",
        "Bravo",
        "Echo",
        "Foxtrot",
      ]);
    });

    it("should default to createdAt order", async () => {
      const { feedService, mockActivityRepository, mockSigaaActivityRepository } = buildMocks();

      await feedService.getFeed({});

      // createdAt default: repo receives default orderBy
      expect(mockActivityRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: "createdAt", order: "desc" }),
      );
      expect(mockSigaaActivityRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: "createdAt", order: "desc" }),
      );
    });
  });
});
