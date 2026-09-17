import { api } from "../../services/api";
import type {
  Action,
  ActionsPage,
  FilterOptions,
  PaginatedResponse,
} from "./types";

export async function fetchActions(
  filters: FilterOptions,
  page = 1,
  limit = 20,
): Promise<ActionsPage> {
  const apiParams: Record<string, string | number> = {
    page,
    limit,
  };

  if (filters.search) {
    apiParams.search = filters.search;
  }

  if (filters.availability === "available") {
    apiParams.status = "OPEN";
  }

  if (filters.actionType !== "all") {
    const typeMap: Record<string, string> = {
      oficina: "COURSE",
      minicurso: "COURSE",
      palestra: "LECTURE",
      evento: "EVENT",
      servico: "EXTENSION",
    };
    const mappedType = typeMap[filters.actionType];

    if (mappedType) {
      apiParams.type = mappedType;
    }
  }

  const response = await api.get<PaginatedResponse<Action>>("/activities", {
    params: apiParams,
  });

  // The route answers with `total` only, so the page count is derived here
  // from the limit this call just sent. An empty slice still spans one page:
  // `Pagination` is told how many pages exist, and zero of them is not a state
  // the feed can render.
  return {
    ...response,
    totalPages: Math.max(1, Math.ceil(response.total / limit)),
  };
}
