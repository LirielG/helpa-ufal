import { api } from "../../services";
import type { UpdateProfileRequest, User } from "../../types";
import { delay } from "../../utils";
import type { ActivityStatus } from "./types";

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

export async function fetchUserActivities(filter: ActivityStatus) {
  const response = await api.get(`/activities?filter=${filter}&page=1&limit=20`);
  return response;
}