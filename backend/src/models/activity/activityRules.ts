import CustomError from "@/models/error/CustomError.js";
import type { ActivityModerationResponse } from "@/types/activity.js";

/** Builds the canonical 410 error for activities removed by moderation. */
export function activityRemovedError(): CustomError {
  return new CustomError(410, "This activity was removed by moderation.", {
    code: "ACTIVITY_REMOVED",
  });
}

/** Rejects operations on an activity that was removed by moderation. */
export function assertActivityNotRemoved(activity: {
  moderation?: ActivityModerationResponse | null;
}): void {
  if (activity.moderation) {
    throw activityRemovedError();
  }
}
