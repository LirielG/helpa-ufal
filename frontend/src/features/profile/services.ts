import { api } from "../../services";
import { useAuthStore } from "../../stores/authStore";
import type { UpdateProfileRequest } from "../../types";
import { formatDate } from "../../utils/date";
import type { Action, PaginatedResponse } from "../dashboard/types";
import type { ActivityStatus, UserActivity, UserProfile } from "./types";

export async function getProfile(): Promise<UserProfile> {
  return await api.get<UserProfile>("/users/me");
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

// The endpoint may answer with the array itself, wrapped in `data`, or in `activities` (PaginatedResponse)
type ActivitiesResponse =
  | UserActivity[]
  | { data?: UserActivity[] }
  | PaginatedResponse<Action>;

export async function fetchUserActivities(
  filter: ActivityStatus,
): Promise<UserActivity[]> {
  const response = await api.get<ActivitiesResponse>(
    `/activities?filter=${filter}&page=1&limit=50`,
  );

  let rawList: (UserActivity | Action)[] = [];

  if (Array.isArray(response)) {
    rawList = response;
  } else if ("data" in response && Array.isArray(response.data)) {
    rawList = response.data;
  } else if ("activities" in response && Array.isArray(response.activities)) {
    rawList = response.activities;
  }

  const currentUser = useAuthStore.getState().user;

  // If the backend returned raw Action objects from /activities, map them to UserActivity
  const mappedList: UserActivity[] = rawList
    .filter((item) => {
      if ("status" in item && (item.status === "enrolled" || item.status === "completed" || item.status === "managed")) {
        return item.status === filter;
      }

      // Backend Action items:
      if (filter === "managed") {
        return "authorId" in item && currentUser ? item.authorId === currentUser.id : false;
      }

      // For enrolled and completed tabs, backend doesn't have /users/me/enrollments yet
      return false;
    })
    .map((item) => {
      if ("location" in item) {
        return item as UserActivity;
      }

      const action = item as Action;
      return {
        id: action.id,
        title: action.title,
        description: action.details?.description || "Sem descrição informada.",
        location: action.campus ? `Campus ${action.campus}` : "Local não informado",
        date: formatDate(action.startDate),
        status: filter,
        workloadHours: action.details?.workloadHours,
      };
    });

  return mappedList;
}

