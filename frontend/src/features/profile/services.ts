import { api, authService } from "../../services";
import type { UpdateProfileRequest } from "../../types";
import { formatDate } from "../../utils/date";
import type {
  ActivityStatus,
  ActivityStatusTransition,
  UpdateActivityStatusRequest,
  UserActivity,
} from "./types";
import type { UserProfile } from "../../types/profile";
import type {
  Activity,
  ActivityListItem,
} from "../../services/contracts/activity";
import type { Paginated } from "../../services/contracts/common";
import type { UserActivityItem } from "../../services/contracts/user";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../dashboard/constants";

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

const LIST_LIMIT = 100;

function locationOf(item: UserActivityItem): string {
  const address = item.details?.address;
  if (address) return `${address.city} - ${address.state}`;

  const format = item.details?.format;
  return format
    ? ACTION_FORMAT_LABELS[format]
    : ACTION_CAMPUS_LABELS[item.campus];
}

/**
 * The first page of the signed-in user's actions in one sub-tab. The tab has
 * no pagination yet, so it asks for the largest page the route allows.
 */
export async function fetchUserActivities(
  filter: ActivityStatus,
): Promise<UserActivity[]> {
  const params = new URLSearchParams({
    filter,
    page: "1",
    limit: String(LIST_LIMIT),
  });
  const response = await api.get<Paginated<UserActivityItem>>(
    `/users/me/activities?${params}`,
  );

  return response.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.details?.description || "Sem descrição informada.",
    location: locationOf(item),
    date: formatDate(item.startDate),
    status: filter,
    activityStatus: item.status,
    workloadHours: item.details?.workloadHours,
    action: item,
  }));
}

export async function updateActivityStatus(
  id: string,
  status: ActivityStatusTransition,
): Promise<Omit<ActivityListItem, "details">> {
  const body: UpdateActivityStatusRequest = { status };
  return await api.patch<Omit<ActivityListItem, "details">>(
    `/activities/${id}/status`,
    body,
  );
}

export async function getActivityById(id: string): Promise<Activity> {
  return await api.get<Activity>(`/activities/${id}`);
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/activities/${id}`);
}
