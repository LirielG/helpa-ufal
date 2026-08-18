import { MapPin, Calendar, CircleCheck } from "lucide-react";
import type { UserActivity } from "../../types";

export function CompletedCard({ activity }: { activity: UserActivity }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-6 shrink-0 text-white fill-[#3BB54A]" />
        <h4 className="font-bold text-gray-900 leading-snug">
          {activity.title}
        </h4>
      </div>
      <p className="text-sm text-gray-600">{activity.description}</p>

      <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
        <span className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-gray-400" />
          {activity.location}
        </span>
        <span className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0 text-gray-400" />
          {activity.date}
        </span>
        {activity.workloadHours != null && (
          <span className="ml-auto bg-[#006300] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            {activity.workloadHours} horas
          </span>
        )}
      </div>
    </div>
  );
}
