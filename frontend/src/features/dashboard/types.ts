import type { ActivityListItem } from "../../services/contracts/activity";
import type { ListActivitiesResponse } from "../../services/contracts/activity";

/**
 * Provisional aliases (#194): the wire types live in
 * `frontend/src/services/contracts/activity.ts`; screens keep the historical
 * `Action*` names.
 */
export type {
  ActivityType as ActionType,
  ActivityFormat as ActionFormat,
  ActivityStatus as ActionStatus,
  CampusLocation as ActionCampus,
} from "../../services/contracts/activity";

export type Action = ActivityListItem;

export interface FilterOptions {
  area: string;
  actionType: string;
  availability: string;
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
