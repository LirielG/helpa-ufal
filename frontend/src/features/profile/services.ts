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
import { formatActionLocation } from "../action-detail/location";

// The one `/users/me` client lives on authService; the profile screen asks for
// the same resource through it, so the session check and this screen cannot
// drift apart on the response shape.
export async function getProfile(): Promise<UserProfile> {
  return authService.me();
}

export async function updateProfile(
  data: UpdateProfileRequest,
): Promise<UserProfile> {
  return api.patch<UserProfile>("/users/me", data);
}

const LIST_LIMIT = 20;

export async function fetchUserActivities(
  filter: ActivityStatus,
  page: number,
): Promise<Paginated<UserActivity>> {
  const params = new URLSearchParams({
    filter,
    page: String(page),
    limit: String(LIST_LIMIT),
  });
  const response = await api.get<Paginated<UserActivityItem>>(
    `/users/me/activities?${params}`,
  );

  return {
    ...response,
    items: response.items.map((item) => ({
      action: item,
      description: item.details?.description || "Sem descrição informada.",
      location: formatActionLocation(item),
      date: formatDate(item.startDate),
      certificate: item.certificate,
      confirmedWorkloadHours: item.enrollment?.confirmedWorkloadHours ?? 0,
    })),
  };
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

export async function downloadCertificate(
  certificateId: string,
): Promise<Blob> {
  return await api.getBlob(`/certificates/${certificateId}/file`);
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/activities/${id}`);
}
