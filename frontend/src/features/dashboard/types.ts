import type {
  ActivityStatus,
  ActivityType,
} from "../../services/contracts/activity";

export interface FilterOptions {
  area: string;
  actionType: ActivityType | "all";
  status: ActivityStatus | "all";
  search?: string;
}
