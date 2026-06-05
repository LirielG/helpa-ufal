import { MapPin, Calendar, Users } from "lucide-react";
import { Link } from "react-router";
import type { Action } from "../types";

interface ActionCardProps {
  action: Action;
}

export function ActionCard({ action }: ActionCardProps) {
  const statusConfig = {
    available: {
      label: "Vagas Disponíveis",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    full: {
      label: "Vagas Esgotadas",
      className: "bg-red-100 text-red-800 border-red-200",
    },
    upcoming: {
      label: "Em Breve",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
  };

  const status = statusConfig[action.status];

  return (
    <Link
      to={`/activity/${action.id}`}
      className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group cursor-pointer"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={action.image}
          alt={action.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {action.title}
        </h3>

        <p className="text-sm text-gray-600 line-clamp-2">
          {action.description}
        </p>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="size-4 shrink-0 mt-0.5 text-gray-400" />
          <span className="line-clamp-1">{action.location}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="size-4 shrink-0 text-gray-400" />
          <span>{action.date}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="size-4 shrink-0 text-gray-400" />
          <span>{action.spots} vagas</span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700 capitalize">
            {action.type}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
