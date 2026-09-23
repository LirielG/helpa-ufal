import type { UserType } from "@/types";

export type ProfileTab = "personal" | "certificates" | "actions";

export type ActivityStatus = "enrolled" | "completed" | "managed";

export interface UserActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  status: ActivityStatus;
  workloadHours?: number;
}

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
