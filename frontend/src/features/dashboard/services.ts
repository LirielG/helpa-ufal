import { api } from "../../services/api";
import type { Action, FilterOptions, PaginatedResponse } from "./types";

export async function fetchActions(
  filters: FilterOptions,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Action>> {
  const apiParams: Record<string, string | number> = {
    page,
    limit,
  };

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

  return api.get<PaginatedResponse<Action>>("/activities", {
    params: apiParams,
  });
}
