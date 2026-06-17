import { MapPin, Calendar, Pencil } from "lucide-react";
import type { UserActivity } from "../../types";

type ManagedCardProps = {
  activity: UserActivity;
  onEdit: (id: string) => void;
};

export function ManagedCard({ activity, onEdit }: ManagedCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md flex items-center justify-between gap-4">
      <div className="flex flex-col gap-3 min-w-0">
        <h4 className="font-bold text-gray-900 leading-snug">
          {activity.title}
        </h4>
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
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEdit(activity.id)}
        aria-label="Editar atividade"
        className="shrink-0 border border-gray-300 rounded-lg p-2 text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <Pencil className="size-4" />
      </button>
    </div>
  );
}
