import type { Activity } from "@/services/contracts/activity";

export type { UserProfile } from "@/types/profile";

export type ProfileTab = "personal" | "certificates" | "actions";

export type ActivityStatus = "enrolled" | "completed" | "managed";

/** An action of the profile's "Ações" tab and the display text derived from it. */
export interface UserActivity {
  /** The action as the enrollment modals of the detail page take it. */
  action: Activity;
  description: string;
  location: string;
  date: string;
}

/** Targets `PATCH /activities/:id/status` accepts; an action never goes back to OPEN. */
export type ActivityStatusTransition = Exclude<Activity["status"], "OPEN">;

export interface UpdateActivityStatusRequest {
  status: ActivityStatusTransition;
}
