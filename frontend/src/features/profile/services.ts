import { api, authService } from "../../services";
import type { UpdateProfileRequest } from "../../types";
import type {
  ActivityStatus,
  ActivityStatusTransition,
  UpdateActivityStatusRequest,
  UserActivity,
} from "./types";
import type { UserProfile } from "../../types/profile";
import type { Action } from "../dashboard/types";
import type { ActionDetail } from "../action-detail/types";

// The one `/users/me` client lives on authService; the profile screen asks for
// the same resource through it, so the session check and this screen cannot
// drift apart on the response shape.
export async function getProfile(): Promise<UserProfile> {
  return authService.me();
}

//Changes made here were done solely to avoid errors in Profile.tsx
export async function updateProfile(
  currentUser: UserProfile,
  data: UpdateProfileRequest,
): Promise<UserProfile> {
  //Delay removed to meet requirement 3.
  return {
    ...currentUser,
    fullName: data.fullName,
    email: data.email,
    //updatedAt: new Date().toISOString(),
  };
}

// The endpoint may answer with the array itself or wrapped in `data`; the feed
// contract is settled in #120, so both shapes are tolerated for now.
type ActivitiesResponse = UserActivity[] | { data?: UserActivity[] };

export async function fetchUserActivities(
  filter: ActivityStatus,
): Promise<UserActivity[]> {
  const response = await api.get<ActivitiesResponse>(
    `/activities?filter=${filter}&page=1&limit=20`,
  );

  return Array.isArray(response) ? response : (response?.data ?? []);
}

export async function updateActivityStatus(
  id: string,
  status: ActivityStatusTransition,
): Promise<Omit<Action, "details">> {
  const body: UpdateActivityStatusRequest = { status };
  return await api.patch<Omit<Action, "details">>(
    `/activities/${id}/status`,
    body,
  );
}

export async function getActivityById(id: string): Promise<ActionDetail> {
  return await api.get<ActionDetail>(`/activities/${id}`);
}
