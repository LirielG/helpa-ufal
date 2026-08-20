import type { ActivityType } from "./activity.js";

export interface IScrapedSigaaActivity {
  sigaaId: string;
  title: string;
  type: string;
  normalizedType: ActivityType;
  department: string | null;
}

export interface ISigaaActivityFilters {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: string;
}
