import type { Activity } from "@/services/contracts/activity";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../dashboard/constants";

/** Where an action happens, in one line: its city, else its format, else its campus. */
export function formatActionLocation(action: Activity): string {
  return (
    formatActionVenue(action) ?? ACTION_FORMAT_LABELS[action.details!.format]
  );
}

export function formatActionVenue(action: Activity): string | null {
  const address = action.details?.address;
  if (address) return `${address.city} - ${address.state}`;

  return action.details?.format ? null : ACTION_CAMPUS_LABELS[action.campus];
}
