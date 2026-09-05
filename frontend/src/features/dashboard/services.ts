import { api } from "../../services/api";
import type { Action, FilterOptions, PaginatedResponse } from "./types";

export async function fetchActions(filters: FilterOptions, page = 1, limit = 20): Promise<PaginatedResponse<Action>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.availability === "available") {
    params.append("status", "OPEN");
  }
  
  if (filters.actionType !== "all") {
    const typeMap: Record<string, string> = {
      oficina: "COURSE",
      minicurso: "COURSE",
      palestra: "LECTURE",
      evento: "EVENT",
      servico: "EXTENSION"
    };
    const mappedType = typeMap[filters.actionType];
    if (mappedType) params.append("type", mappedType);
  }

  const response = await api.get(`/activities?${params.toString()}`);
  return response as PaginatedResponse<Action>;
}