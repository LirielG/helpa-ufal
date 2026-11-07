import type { Paginated } from "../../services/contracts/common";

/** Mirrors SigaaActivityResponse in backend/src/types/sigaa.ts. */
export interface SigaaActivity {
  id: string;
  sigaaId: string;
  title: string;
  /** Raw SIGAA label, exactly as scraped. Also the value the type filter sends. */
  type: string;
  normalizedType: string;
  department: string | null;
  lastSeenAt: string;
}

export type SigaaListResponse = Paginated<SigaaActivity>;

export interface SigaaFilterOptions {
  types: string[];
  departments: string[];
}

export interface SigaaFeedFilters {
  search: string;
  type: string;
  department: string;
  /** Id of an entry in SIGAA_ORDER_OPTIONS, which carries the orderBy/order pair. */
  order: string;
}
