import { api } from "../../services/api";
import type {
  ListActivitiesResponse,
  ActivityListItem,
} from "../../services/contracts/activity";
import type { FilterOptions } from "./types";

export async function fetchActions(
  filters: FilterOptions,
  page = 1,
  limit = 20,
): Promise<ListActivitiesResponse> {
  const apiParams: Record<string, string | number> = {
    page,
    limit,
  };

  if (filters.search) {
    apiParams.search = filters.search;
  }

  if (filters.area !== "all") {
    apiParams.area = filters.area;
  }

  if (filters.status !== "all") {
    apiParams.status = filters.status;
  }

  if (filters.actionType !== "all") {
    apiParams.type = filters.actionType;
  }

  return api.get<ListActivitiesResponse>("/activities", {
    params: apiParams,
  });
}

export async function fetchAreaSuggestions(): Promise<string[]> {
  try {
    const response = await api.get<{ areas: string[] }>("/activities/filters");
    return response.areas ?? [];
  } catch {
    return [];
  }
}

export async function fetchFeaturedActions(): Promise<ActivityListItem[]> {
  const response = await api.get<ListActivitiesResponse>("/activities", {
    params: {
      status: "OPEN",
      orderBy: "start_date",
      order: "asc",
      limit: 4,
    },
  });

  return response.items;
}
