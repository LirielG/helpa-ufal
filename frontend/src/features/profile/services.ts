import { api } from "../../services";
import type { UpdateProfileRequest } from "../../types";
import type { ActivityStatus, UserActivity, UserProfile } from "./types";

export async function getProfile(): Promise<UserProfile> {
  return await api.get<UserProfile>("/users/me");
}

//alterações feitas aqui fora feitas apenas para não dar erro na Profile.tsx
export async function updateProfile(
  currentUser: UserProfile,
  data: UpdateProfileRequest,
): Promise<UserProfile> {
  //delay retirado para cumprimento do requisito 3
  return await{
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
