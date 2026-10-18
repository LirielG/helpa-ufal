import type { Activity } from "@/services/contracts/activity";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../dashboard/constants";

/** Where an action happens, in one line: its city, else its format, else its campus. */
export function formatActionLocation(action: Activity): string {
  const address = action.details?.address;
  if (address) return `${address.city} - ${address.state}`;

  const format = action.details?.format;
  return format
    ? ACTION_FORMAT_LABELS[format]
    : ACTION_CAMPUS_LABELS[action.campus];
}
