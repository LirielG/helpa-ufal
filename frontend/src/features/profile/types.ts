import type { UserType } from "@/types";
import type { Action, ActionStatus } from "@/features/dashboard/types";

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
  activityStatus: ActionStatus;
  workloadHours?: number;
}

/** Targets `PATCH /activities/:id/status` accepts; an action never goes back to OPEN. */
export type ActivityStatusTransition = Exclude<ActionStatus, "OPEN">;

export interface UpdateActivityStatusRequest {
  status: ActivityStatusTransition;
}

export type UpdateActivityStatusResponse = Action;

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
