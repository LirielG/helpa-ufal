import type { UserType } from "./auth";

/**
 * Body of `GET /users/me`. It extends what `User` describes with the academic
 * fields, so it is also the profile the screen shows.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
  isManager: boolean;
  registrationCode: string;
  course: string | null;
  cndb: string | null;
  createdAt: string;
}
