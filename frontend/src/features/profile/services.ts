import { api, authService } from "../../services";
import { useAuthStore } from "../../stores/authStore";
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
  ListActivitiesResponse,
} from "../../services/contracts/activity";

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

// The endpoint may answer with the array itself, wrapped in `data`, or with the
// `activities` envelope (ListActivitiesResponse).
type ActivitiesResponse =
  | UserActivity[]
  | { data?: UserActivity[] }
  | ListActivitiesResponse;

/**
 * TEMPORARY WORKAROUND — remove in #118, do not keep.
 *
 * `GET /activities` ignores `filter` and returns the paginated public listing,
 * so the "managed" tab is approximated here by keeping the actions whose
 * `authorId` is the signed-in user. Two consequences until the real route lands:
 * - only the first 50 actions of the public listing are considered; a managed
 *   action beyond that does not show up;
 * - "enrolled" and "completed" return nothing, as there is no source for them.
 *
 * The replacement is `GET /users/me/activities` (#60), wired into this tab by
 * #118. When that lands, delete the `authorId` filter and the Action →
 * UserActivity mapping below and consume the endpoint's response directly.
 */
export async function fetchUserActivities(
  filter: ActivityStatus,
): Promise<UserActivity[]> {
  const response = await api.get<ActivitiesResponse>(
    `/activities?filter=${filter}&page=1&limit=50`,
  );

  let rawList: (UserActivity | ActivityListItem)[] = [];

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

      const action = item as ActivityListItem;
      return {
        id: action.id,
        title: action.title,
        description: action.details?.description || "Sem descrição informada.",
        location: action.campus ? `Campus ${action.campus}` : "Local não informado",
        date: formatDate(action.startDate),
        status: filter,
        activityStatus: action.status,
        workloadHours: action.details?.workloadHours,
      };
    });

  return mappedList;
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
