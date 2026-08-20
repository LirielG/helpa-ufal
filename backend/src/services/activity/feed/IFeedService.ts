import type { IFeedFilters, IFeedResponse } from "@/types/activity.js";

export interface IFeedService {
  getFeed(filters: IFeedFilters): Promise<IFeedResponse>;
}
