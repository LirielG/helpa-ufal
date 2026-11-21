import { MapPin, Calendar, Clock } from "lucide-react";
import type { Activity } from "@/services/contracts/activity";
import { formatDate, formatWorkloadHours } from "../../../utils";
import { formatActionVenue } from "../location";
import { ACTION_FORMAT_LABELS } from "../../dashboard/constants";

/** Title, date, location and workload of an action, as the enrollment modals recap it. */
export function ActionSummary({ action }: { action: Activity }) {
  const format = action.details?.format;
  const venue = formatActionVenue(action);

  return (
    <div className="w-full bg-gray-100 rounded-xl px-5 py-4 text-left space-y-2">
      <p className="font-semibold text-gray-900">{action.title}</p>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="size-4 shrink-0 text-gray-400" />
        <span>{formatDate(action.startDate)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="size-4 shrink-0 text-gray-400" />
        {format && (
          <span className="inline-block bg-[#1B75BB] text-white text-xs font-semibold px-3 py-1 rounded-full">
            {ACTION_FORMAT_LABELS[format]}
          </span>
        )}
        {venue && <span>{venue}</span>}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock className="size-4 shrink-0 text-gray-400" />
        <span>{formatWorkloadHours(action.details?.workloadHours ?? 0)}</span>
      </div>
    </div>
  );
}
