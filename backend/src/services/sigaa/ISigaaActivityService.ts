import type {
  SigaaActivityFilters,
  SigaaFilterOptions,
  SigaaListResponse,
} from "@/types/sigaa.js";

export interface ISigaaActivityService {
  list(filters: SigaaActivityFilters): Promise<SigaaListResponse>;
  listFilterOptions(): Promise<SigaaFilterOptions>;
}
