import type { UserProfileResponse } from "@/types/user.js";
import type { UserActivityResponse } from "@/types/activity.js";
import type { Paginated } from "@/types/pagination.js";
import type { ListUserActivitiesQuery } from "@/schemas/user/UserActivitySchemas.js";

export type UpdateProfileInput = {
  fullName?: string;
  course?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export interface IUserService {
  getProfile(userId: string): Promise<UserProfileResponse>;
  updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfileResponse>;
  listActivities(
    userId: string,
    query: ListUserActivitiesQuery,
  ): Promise<Paginated<UserActivityResponse>>;
}
