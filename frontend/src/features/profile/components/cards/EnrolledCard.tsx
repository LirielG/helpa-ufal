import { MapPin, Calendar } from "lucide-react";
import type { UserActivity } from "../../types";

export function EnrolledCard({ activity }: { activity: UserActivity }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md flex flex-col gap-3">
      <h4 className="font-bold text-gray-900 leading-snug">{activity.title}</h4>
      <p className="text-sm text-gray-600">{activity.description}</p>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="size-4 shrink-0 text-gray-400" />
        <span>{activity.location}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="size-4 shrink-0 text-gray-400" />
        <span>{activity.date}</span>
      </div>
    </div>
  );
}
