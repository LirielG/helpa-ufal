import { api, authService } from "../../services";
import type { UpdateProfileRequest } from "../../types";
import type { ActivityStatus, UserActivity } from "./types";
import type { UserProfile } from "../../types/profile";

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
