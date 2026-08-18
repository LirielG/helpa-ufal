import type { UserType } from "@/types/auth.js";

export type UserProfileResponse = {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
  isManager: boolean;
  createdAt: Date;
  updatedAt: Date;
  course?: string | null;
  registrationCode?: string | null;
  cndb?: string | null;
  student?: {
    registrationCode: string;
    course: string;
  } | null;
  teacher?: {
    registrationCode: string;
    cndb: string;
    course?: string | null;
  } | null;
};
