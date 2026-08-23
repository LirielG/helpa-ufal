import type { ActivityType } from "./activity.js";

export const SIGAA_TYPES = [
  "EVENTO",
  "CURSO",
  "PRODUTO",
  "PROGRAMA",
  "PROJETO",
  "PRESTAÇÃO DE SERVIÇOS",
] as const;

export type SigaaRawType = (typeof SIGAA_TYPES)[number];

export interface IScrapedSigaaActivity {
  sigaaId: string;
  title: string;
  type: string;
  normalizedType: ActivityType;
  department: string | null;
}

export type SigaaActivityResponse = {
  id: string;
  sigaaId: string;
  title: string;
  type: string;
  department: string | null;
  lastSeenAt: Date;
};

export type SigaaListResponse = {
  items: SigaaActivityResponse[];
  total: number;
  page: number;
  limit: number;
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
