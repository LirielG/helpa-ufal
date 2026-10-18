import type { UserProfileResponse } from "@/types/user.js";
import type { UserActivityResponse } from "@/types/activity.js";
import type { Paginated } from "@/types/pagination.js";
import type { ListUserActivitiesQuery } from "@/schemas/user/UserActivitySchemas.js";

export interface IUserService {
  getProfile(userId: string): Promise<UserProfileResponse>;
  listActivities(
    userId: string,
    query: ListUserActivitiesQuery,
  ): Promise<Paginated<UserActivityResponse>>;
}
