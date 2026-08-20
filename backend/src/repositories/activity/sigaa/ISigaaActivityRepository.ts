import type { SigaaActivity } from "@prisma/client";
import type { IScrapedSigaaActivity, ISigaaActivityFilters } from "@/types/sigaa.js";

export interface ISigaaActivityRepository {
  getLatestLastSeenAt(): Promise<Date | null>;
  upsertMany(activities: IScrapedSigaaActivity[], syncTimestamp: Date): Promise<void>;
  markInactiveBefore(syncTimestamp: Date): Promise<number>;
  list(filters: ISigaaActivityFilters): Promise<{ activities: SigaaActivity[]; total: number }>;
}
