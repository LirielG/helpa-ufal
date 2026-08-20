import type { IFeedService } from "./IFeedService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { ISigaaActivityRepository } from "@/repositories/activity/sigaa/ISigaaActivityRepository.js";
import type { ISigaaSyncService } from "@/services/activity/sigaa/ISigaaSyncService.js";
import type {
  FeedItemResponse,
  IFeedFilters,
  IFeedResponse,
} from "@/types/activity.js";
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import SigaaActivityRepository from "@/repositories/activity/sigaa/SigaaActivityRepository.js";
import SigaaSyncService from "@/services/activity/sigaa/SigaaSyncService.js";
import { SIGAA_PUBLIC_SEARCH_URL } from "@/services/activity/sigaa/SigaaScraperService.js";
import ValidationError, {
  type ValidationErrorItem,
} from "@/models/error/ValidationError.js";

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const VALID_FORMATS = ["IN_PERSON", "ONLINE", "HYBRID"];
const VALID_TYPES = ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"];
const VALID_ORDER_FIELDS = ["title", "type", "createdAt"];
const VALID_ORDERS = ["asc", "desc"];
const VALID_SOURCES = ["LOCAL", "SIGAA", "ALL"];

type Props = {
  activityRepository?: IActivityRepository;
  sigaaActivityRepository?: ISigaaActivityRepository;
  sigaaSyncService?: ISigaaSyncService;
};

export class FeedService implements IFeedService {
  private _activityRepository: IActivityRepository;
  private _sigaaActivityRepository: ISigaaActivityRepository;
  private _sigaaSyncService: ISigaaSyncService;

  constructor(props?: Props) {
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
    this._sigaaActivityRepository =
      props?.sigaaActivityRepository ?? new SigaaActivityRepository();
    this._sigaaSyncService = props?.sigaaSyncService ?? new SigaaSyncService();
  }

  public async getFeed(filters: IFeedFilters): Promise<IFeedResponse> {
    this.validateFilters(filters);

    await this._sigaaSyncService.syncIfNeeded();

    const page = Math.max(1, parseInt(filters.page || "1", 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(filters.limit || "10", 10) || 10),
    );
    const sourceFilter = (filters.source || "ALL").toUpperCase();
    const orderBy = filters.orderBy || "createdAt";
    const order = filters.order === "asc" ? "asc" : "desc";

    const excludeSigaa = this.sigaaExcludedByFilters(filters);

    // ── source=LOCAL ──
    if (sourceFilter === "LOCAL") {
      const result = await this._activityRepository.list({
        type: filters.type,
        campus: filters.campus,
        format: filters.format,
        status: filters.status || "OPEN",
        search: filters.search,
        page,
        limit,
        orderBy,
        order,
      });

      return {
        items: result.activities.map((act) => this.toLocalItem(act)),
        total: result.total,
        page,
        limit,
      };
    }

    // ── source=SIGAA ──
    if (sourceFilter === "SIGAA") {
      if (excludeSigaa) {
        return { items: [], total: 0, page, limit };
      }

      const result = await this._sigaaActivityRepository.list({
        type: filters.type,
        search: filters.search,
        page,
        limit,
        orderBy,
        order,
      });

      return {
        items: result.activities.map((sigaa) => this.toSigaaItem(sigaa)),
        total: result.total,
        page,
        limit,
      };
    }

    // ── source=ALL: merge-sort ──
    const fetchLimit = page * limit;

    const localPromise = this._activityRepository.list({
      type: filters.type,
      campus: filters.campus,
      format: filters.format,
      status: filters.status || "OPEN",
      search: filters.search,
      page: 1,
      limit: fetchLimit,
      orderBy,
      order,
    });

    const sigaaPromise = excludeSigaa
      ? Promise.resolve({ activities: [], total: 0 })
      : this._sigaaActivityRepository.list({
          type: filters.type,
          search: filters.search,
          page: 1,
          limit: fetchLimit,
          orderBy,
          order,
        });

    const [localResult, sigaaResult] = await Promise.all([
      localPromise,
      sigaaPromise,
    ]);

    const localItems = localResult.activities.map((act) =>
      this.toLocalItem(act),
    );
    const sigaaItems = sigaaResult.activities.map((sigaa) =>
      this.toSigaaItem(sigaa),
    );

    // Merge-sort: ambas listas já vêm ordenadas do banco
    const merged = this.mergeSorted(localItems, sigaaItems, orderBy, order);
    const startIndex = (page - 1) * limit;
    const paginatedItems = merged.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total: localResult.total + sigaaResult.total,
      page,
      limit,
    };
  }

  private validateFilters(filters: IFeedFilters): void {
    const errors: ValidationErrorItem[] = [];

    if (filters.type && !VALID_TYPES.includes(filters.type)) {
      errors.push({
        field: "type",
        message: `type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (filters.status && !VALID_STATUSES.includes(filters.status)) {
      errors.push({
        field: "status",
        message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    if (filters.format && !VALID_FORMATS.includes(filters.format)) {
      errors.push({
        field: "format",
        message: `format must be one of: ${VALID_FORMATS.join(", ")}`,
      });
    }

    if (filters.orderBy && !VALID_ORDER_FIELDS.includes(filters.orderBy)) {
      errors.push({
        field: "orderBy",
        message: `orderBy must be one of: ${VALID_ORDER_FIELDS.join(", ")}`,
      });
    }

    if (filters.order && !VALID_ORDERS.includes(filters.order)) {
      errors.push({
        field: "order",
        message: `order must be one of: ${VALID_ORDERS.join(", ")}`,
      });
    }

    if (
      filters.source &&
      !VALID_SOURCES.includes(filters.source.toUpperCase())
    ) {
      errors.push({
        field: "source",
        message: `source must be one of: ${VALID_SOURCES.join(", ")}`,
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }

  private sigaaExcludedByFilters(filters: IFeedFilters): boolean {
    if (filters.campus) return true;
    if (filters.format) return true;
    if (filters.status) return true;
    return false;
  }

  private toLocalItem(act: {
    id: string;
    authorId: string;
    title: string;
    type: string;
    campus: string;
    startDate: Date;
    endDate: Date;
    slots: number;
    availableSlots: number;
    status: string;
  }): FeedItemResponse {
    return {
      id: act.id,
      source: "LOCAL",
      authorId: act.authorId,
      title: act.title,
      type: act.type as FeedItemResponse["type"],
      campus: act.campus as FeedItemResponse["campus"],
      startDate: act.startDate,
      endDate: act.endDate,
      slots: act.slots,
      availableSlots: act.availableSlots,
      status: act.status as FeedItemResponse["status"],
    };
  }

  private toSigaaItem(sigaa: {
    id: string;
    title: string;
    normalizedType: string;
    type: string;
    department?: string | null;
  }): FeedItemResponse {
    const item: FeedItemResponse = {
      id: sigaa.id,
      source: "SIGAA",
      title: sigaa.title,
      type: sigaa.normalizedType as FeedItemResponse["type"],
      url: SIGAA_PUBLIC_SEARCH_URL,
      originalType: sigaa.type,
    };
    if (sigaa.department) {
      item.department = sigaa.department;
    }
    return item;
  }

  private mergeSorted(
    a: FeedItemResponse[],
    b: FeedItemResponse[],
    orderBy: string,
    order: "asc" | "desc",
  ): FeedItemResponse[] {
    const result: FeedItemResponse[] = [];
    let i = 0;
    let j = 0;

    const compare = (x: FeedItemResponse, y: FeedItemResponse): number => {
      let cmp = 0;
      switch (orderBy) {
        case "title":
          cmp = (x.title || "").localeCompare(y.title || "");
          break;
        case "type":
          cmp = (x.type || "").localeCompare(y.type || "");
          break;
        case "createdAt":
        default:
          return 0;
      }
      return order === "asc" ? cmp : -cmp;
    };

    while (i < a.length && j < b.length) {
      if (compare(a[i], b[j]) <= 0) {
        result.push(a[i]);
        i++;
      } else {
        result.push(b[j]);
        j++;
      }
    }

    while (i < a.length) {
      result.push(a[i]);
      i++;
    }

    while (j < b.length) {
      result.push(b[j]);
      j++;
    }

    return result;
  }
}

export default FeedService;
