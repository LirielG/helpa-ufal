import { api } from "../../services/api";
import { ALL_OPTION, SIGAA_ORDER_OPTIONS, SIGAA_PAGE_SIZE } from "./constants";
import type {
  SigaaFeedFilters,
  SigaaFilterOptions,
  SigaaListResponse,
} from "./types";

export function fetchSigaaActivities(
  filters: SigaaFeedFilters,
  page = 1,
  limit = SIGAA_PAGE_SIZE,
): Promise<SigaaListResponse> {
  const selectedOrder =
    SIGAA_ORDER_OPTIONS.find((option) => option.value === filters.order) ??
    SIGAA_ORDER_OPTIONS[0];

  return api.get<SigaaListResponse>("/sigaa-activities", {
    // api.get drops empty values, so "all" is the only sentinel to strip here.
    params: {
      page,
      limit,
      search: filters.search,
      type: filters.type === ALL_OPTION ? "" : filters.type,
      department: filters.department === ALL_OPTION ? "" : filters.department,
      orderBy: selectedOrder.orderBy,
      order: selectedOrder.order,
    },
  });
}

export function fetchSigaaFilterOptions(): Promise<SigaaFilterOptions> {
  return api.get<SigaaFilterOptions>("/sigaa-activities/filters");
}
