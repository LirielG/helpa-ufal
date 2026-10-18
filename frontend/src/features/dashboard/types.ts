import type {
  ListActivitiesResponse,
  ActivityStatus,
} from "../../services/contracts/activity";

export interface FilterOptions {
  area: string;
  actionType: string;
  status: ActivityStatus | "all";
  search?: string;
}

/**
 * An API page plus the page count derived from the limit the client sent.
 * The route answers with the `activities` envelope (§3 deviation), so this
 * extends `ListActivitiesResponse` rather than `Paginated<T>`.
 */
export interface ActionsPage extends ListActivitiesResponse {
  totalPages: number;
}
