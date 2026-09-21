import type { UserType } from "@/types/auth.js";

export type UserProfileResponse = {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
  isManager: boolean;
  registrationCode: string;
  /** Null only for a TEACHER with no course attached. */
  course: string | null;
  /** Null for a STUDENT: the field only exists on Teacher. */
  cndb: string | null;
  createdAt: Date;
};
