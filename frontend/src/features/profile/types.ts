import type { Activity } from "@/services/contracts/activity";
import type { UserActivityCertificate } from "@/services/contracts/user";

export type { UserProfile } from "@/types/profile";

/** The sub-tabs of /my-activities, read from its ?filter=. */
export type ActivityStatus = "enrolled" | "completed" | "managed";

/** Every list of the user's actions: the sub-tabs plus /my-certificates. */
export type UserActivityList = ActivityStatus | "certified";

/** An action of the user's lists in /my-activities and the display text derived from it. */
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

/** Targets `PUT /activities/:id/status` accepts; an action never goes back to OPEN. */
export type ActivityStatusTransition = Exclude<Activity["status"], "OPEN">;

export interface UpdateActivityStatusRequest {
  status: ActivityStatusTransition;
}
