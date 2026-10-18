import { MapPin, Calendar, Clock } from "lucide-react";
import type { Activity } from "@/services/contracts/activity";
import { formatDate } from "../../../utils";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../../dashboard/constants";

/** Title, date, location and workload of an action, as the enrollment modals recap it. */
export function ActionSummary({ action }: { action: Activity }) {
  const address = action.details?.address;
  const format = action.details?.format;
  const location = address
    ? `${address.city} - ${address.state}`
    : format
      ? ACTION_FORMAT_LABELS[format]
      : ACTION_CAMPUS_LABELS[action.campus];

  return (
    <div className="w-full bg-gray-100 rounded-xl px-5 py-4 text-left space-y-2">
      <p className="font-semibold text-gray-900">{action.title}</p>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="size-4 shrink-0 text-gray-400" />
        <span>{formatDate(action.startDate)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="size-4 shrink-0 text-gray-400" />
        <span>{location}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock className="size-4 shrink-0 text-gray-400" />
        <span>{action.details?.workloadHours ?? 0} horas</span>
      </div>
    </div>
  );
}
