import type { SigaaActivity } from "@prisma/client";
import type { IScrapedSigaaActivity } from "@/types/sigaa.js";

export type SigaaRepoFilters = {
  search?: string;
  type?: string;
  department?: string;
  page: number;
  limit: number;
  orderBy: string;
  order: "asc" | "desc";
};

export interface ISigaaActivityRepository {
  getLatestLastSeenAt(): Promise<Date | null>;
  upsertMany(activities: IScrapedSigaaActivity[], syncTimestamp: Date): Promise<void>;
  markInactiveBefore(syncTimestamp: Date): Promise<number>;
  list(filters: SigaaRepoFilters): Promise<{ activities: SigaaActivity[]; total: number }>;
  listDistinctDepartments(): Promise<string[]>;
}
