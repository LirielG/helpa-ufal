import { api } from "../../services";
import type { UpdateProfileRequest } from "../../types";
import type {
  ActivityStatus,
  ActivityStatusTransition,
  UserActivity,
  UserProfile,
} from "./types";
import type { Action } from "../dashboard/types";

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

const MOCK_MANAGED_ACTIVITIES: UserActivity[] = [
  {
    id: "act-open-1",
    title: "Mutirão de Saúde Comunitária",
    description: "Ação voltada para atendimento básico de saúde na comunidade.",
    location: "Campus Arapiraca",
    date: "15/11/2026",
    status: "managed",
    activityStatus: "OPEN",
    workloadHours: 20,
  },
  {
    id: "act-progress-2",
    title: "Oficina de Inclusão Digital",
    description: "Capacitação em informática para idosos da região.",
    location: "Online (Google Meet)",
    date: "20/10/2026",
    status: "managed",
    activityStatus: "IN_PROGRESS",
    workloadHours: 15,
  },
  {
    id: "act-completed-3",
    title: "I Simpósio de Extensão Universitária",
    description: "Apresentação de projetos de extensão do campus.",
    location: "Campus Maceió",
    date: "01/09/2026",
    status: "managed",
    activityStatus: "COMPLETED",
    workloadHours: 30,
  },
  {
    id: "act-cancelled-4",
    title: "Feira de Profissões e Carreiras",
    description: "Orientação vocacional para alunos do ensino médio.",
    location: "Campus Delmiro Gouveia",
    date: "05/08/2026",
    status: "managed",
    activityStatus: "CANCELLED",
    workloadHours: 10,
  },
];

// The endpoint may answer with the array itself or wrapped in `data`; the feed
// contract is settled in #120, so both shapes are tolerated for now.
type ActivitiesResponse = UserActivity[] | { data?: UserActivity[] };

export async function fetchUserActivities(
  filter: ActivityStatus,
): Promise<UserActivity[]> {
  //For mock data only. Delete after API integration.
  if (filter === "managed") {
    return MOCK_MANAGED_ACTIVITIES;
  }

  try {
    const response = await api.get<ActivitiesResponse>(
      `/activities?filter=${filter}&page=1&limit=20`,
    );
    return Array.isArray(response) ? response : (response?.data ?? []);
  } catch {
    return [];
  }
}

// Stub so the #179 tests compile; the implementation replaces it.
export async function updateActivityStatus(
  id: string,
  status: ActivityStatusTransition,
): Promise<Omit<Action, "details">> {
  //Updates the local mock for manual testing in the browser. Delete after API integration.
  const mockItem = MOCK_MANAGED_ACTIVITIES.find((item) => item.id === id);
  if (mockItem) {
    mockItem.activityStatus = status;
  }

  try {
    return await api.patch<Omit<Action, "details">>(
      `/activities/${id}/status`,
      { status },
    );
  } catch (err) {
    // Delete after API integration
    if (mockItem) {
      return {
        id: mockItem.id,
        authorId: "user-mock-123",
        title: mockItem.title,
        type: "EXTENSION",
        campus: "ARAPIRACA",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        slots: 50,
        availableSlots: 50,
        status,
      } as Omit<Action, "details">;
    }
    throw err;
  }
}

export async function getActivityById(id: string): Promise<Action> {
  return await api.get<Action>(`/activities/${id}`);
}
