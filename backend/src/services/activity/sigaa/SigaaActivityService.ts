import type { ISigaaActivityService } from "./ISigaaActivityService.js";
import type { ISigaaActivityRepository } from "@/repositories/activity/sigaa/ISigaaActivityRepository.js";
import type { ISigaaSyncService } from "./ISigaaSyncService.js";
import type { SigaaActivityFilters, SigaaListResponse } from "@/types/sigaa.js";
import SigaaActivityRepository from "@/repositories/activity/sigaa/SigaaActivityRepository.js";
import SigaaSyncService from "./SigaaSyncService.js";
import ValidationError, { type ValidationErrorItem } from "@/models/error/ValidationError.js";

const VALID_SIGAA_TYPES = [
  "EVENTO", "CURSO", "PRODUTO",
  "PROGRAMA", "PROJETO", "PRESTAÇÃO DE SERVIÇOS",
];
const VALID_ORDER_BY = ["title", "lastSeenAt"];
const VALID_ORDERS = ["asc", "desc"];

type Props = {
  sigaaActivityRepository?: ISigaaActivityRepository;
  sigaaSyncService?: ISigaaSyncService;
};

export class SigaaActivityService implements ISigaaActivityService {
  private _repo: ISigaaActivityRepository;
  private _syncService: ISigaaSyncService;

  constructor(props?: Props) {
    this._repo = props?.sigaaActivityRepository ?? new SigaaActivityRepository();
    this._syncService = props?.sigaaSyncService ?? new SigaaSyncService();
  }

  public async list(filters: SigaaActivityFilters): Promise<SigaaListResponse> {
    this.validateFilters(filters);

    await this._syncService.syncIfNeeded();

    const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || "10", 10) || 10));
    const orderBy = filters.orderBy || "lastSeenAt";
    const order = (filters.order === "asc" ? "asc" : "desc") as "asc" | "desc";

    const result = await this._repo.list({
      search: filters.search,
      type: filters.type,
      department: filters.department,
      page,
      limit,
      orderBy,
      order,
    });

    return {
      items: result.activities.map((a) => ({
        id: a.id,
        sigaaId: a.sigaaId,
        title: a.title,
        type: a.type,
        department: a.department,
        lastSeenAt: a.lastSeenAt,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  public async listDepartments(): Promise<string[]> {
    return this._repo.listDistinctDepartments();
  }

  private validateFilters(filters: SigaaActivityFilters): void {
    const errors: ValidationErrorItem[] = [];

    if (filters.type && !VALID_SIGAA_TYPES.includes(filters.type)) {
      errors.push({ field: "type", message: `type must be one of: ${VALID_SIGAA_TYPES.join(", ")}` });
    }
    if (filters.orderBy && !VALID_ORDER_BY.includes(filters.orderBy)) {
      errors.push({ field: "orderBy", message: `orderBy must be one of: ${VALID_ORDER_BY.join(", ")}` });
    }
    if (filters.order && !VALID_ORDERS.includes(filters.order)) {
      errors.push({ field: "order", message: `order must be one of: ${VALID_ORDERS.join(", ")}` });
    }

    if (errors.length > 0) throw new ValidationError(errors);
  }
}

export default SigaaActivityService;
