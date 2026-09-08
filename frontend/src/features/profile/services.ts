import { api } from "../../services";
import type { UpdateProfileRequest, User } from "../../types";
import { delay } from "../../utils";
import type { ActivityStatus, UserActivity } from "./types";

const MOCK_PROFILE_EXTRAS = {
  registrationCode: "2021000000",
  course: "Curso Exemplo",
  institution: "UNIESQUINA",
  totalHours: 0,
  avatarUrl:
    "https://ui-avatars.com/api/?name=Perfil&background=3b82f6&color=fff",
} satisfies Pick<
  User,
  "registrationCode" | "course" | "institution" | "totalHours" | "avatarUrl"
>;

export async function getProfile(currentUser: User): Promise<User> {
  await delay(300);
  return { ...MOCK_PROFILE_EXTRAS, ...currentUser };
}

export async function updateProfile(
  currentUser: User,
  data: UpdateProfileRequest,
): Promise<User> {
  await delay(600);
  return {
    ...currentUser,
    fullName: data.fullName,
    email: data.email,
    updatedAt: new Date().toISOString(),
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
