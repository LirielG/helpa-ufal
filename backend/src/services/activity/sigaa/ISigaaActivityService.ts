import type { SigaaActivityFilters, SigaaListResponse } from "@/types/sigaa.js";

export interface ISigaaActivityService {
  list(filters: SigaaActivityFilters): Promise<SigaaListResponse>;
  listDepartments(): Promise<string[]>;
}
