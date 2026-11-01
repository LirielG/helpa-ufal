import type { Activity } from "@/services/contracts/activity";
import type { UserActivityCertificate } from "@/services/contracts/user";

export type { UserProfile } from "@/types/profile";

export type ProfileTab = "personal" | "actions";

export type ActivityStatus = "enrolled" | "completed" | "managed";

/** An action of the profile's "Ações" tab and the display text derived from it. */
export interface UserActivity {
  /** The action as the enrollment modals of the detail page take it. */
  action: Activity;
  description: string;
  location: string;
  date: string;
  /** null until the presence is homologated as present; then it can be downloaded. */
  certificate: UserActivityCertificate | null;
  /** May be lower than the action's planned hours; 0 while not homologated. */
  confirmedWorkloadHours: number;
}

/** Targets `PATCH /activities/:id/status` accepts; an action never goes back to OPEN. */
export type ActivityStatusTransition = Exclude<Activity["status"], "OPEN">;

export interface UpdateActivityStatusRequest {
  status: ActivityStatusTransition;
}
