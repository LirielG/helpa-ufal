import type { UpdateProfileRequest, User } from "../../types";
import { delay } from "../../utils";

/**
 * Mock profile data used to fill the fields that the current auth endpoints do
 * not return yet (registrationCode, course, institution, totalHours, avatarUrl).
 */
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

/**
 * Fetches the authenticated user's full profile.
 * Currently backed by the store user merged with mock extras, behind a
 * simulated network delay. Replace the body with a real fetch call (GET
 * /auth/me) when the API is ready.
 */
export async function getProfile(currentUser: User): Promise<User> {
  await delay(300);
  return { ...MOCK_PROFILE_EXTRAS, ...currentUser };
}

/**
 * Updates the authenticated user's profile.
 * Currently a mock that echoes the changes back after a short delay.
 * Replace the body with a real fetch call (PUT /auth/profile) when the API is
 * ready. The `password` field is write-only and never returned.
 */
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
