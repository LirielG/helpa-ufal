import type { Activity } from "@/services/contracts/activity";

export type { UserProfile } from "@/types/profile";

export type ProfileTab = "personal" | "certificates" | "actions";

export type ActivityStatus = "enrolled" | "completed" | "managed";

export interface UserActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  status: ActivityStatus;
  /** Lifecycle status of the action itself, as opposed to the sub-tab in `status`. */
  activityStatus: Activity["status"];
  workloadHours?: number;
}

/** Targets `PATCH /activities/:id/status` accepts; an action never goes back to OPEN. */
export type ActivityStatusTransition = Exclude<Activity["status"], "OPEN">;

export interface UpdateActivityStatusRequest {
  status: ActivityStatusTransition;
}
