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
