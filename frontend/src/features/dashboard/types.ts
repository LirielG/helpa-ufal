import type {
  ActivityStatus,
  ActivityType,
} from "../../services/contracts/activity";

export type StatusFilterValue = ActivityStatus | "ALL";

export interface FilterOptions {
  area: string;
  actionType: ActivityType | "all";
  status: StatusFilterValue;
  search?: string;
}