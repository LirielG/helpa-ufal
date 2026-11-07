import type { ActivityType } from "./activity.js";
import type { Paginated } from "./pagination.js";

export type ScrapedSigaaActivity = {
  sigaaId: string;
  title: string;
  type: string;
  normalizedType: ActivityType;
  department: string | null;
};

export type SigaaActivityResponse = {
  id: string;
  sigaaId: string;
  title: string;
  type: string;
  normalizedType: string;
  department: string | null;
  lastSeenAt: Date;
};

export type SigaaListResponse = Paginated<SigaaActivityResponse>;

export type SigaaFilterOptions = {
  types: string[];
  departments: string[];
};

export type SigaaActivityFilters = {
  search?: string;
  type?: string;
  department?: string;
  page?: string;
  limit?: string;
  orderBy?: string;
  order?: string;
};
