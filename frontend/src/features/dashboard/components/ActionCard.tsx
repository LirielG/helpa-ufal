import { MapPin, Calendar, Users } from "lucide-react";
import { Link } from "react-router";
import type { Action } from "../types";

interface ActionCardProps {
  action: Action;
}

export function ActionCard({ action }: ActionCardProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    OPEN: {
      label: "Inscrições Abertas",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    IN_PROGRESS: {
      label: "Em Andamento",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    COMPLETED: {
      label: "Finalizada",
      className: "bg-gray-100 text-gray-800 border-gray-200",
    },
    CANCELLED: {
      label: "Cancelada",
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const typeMap: Record<string, string> = {
    EXTENSION: "Extensão",
    COURSE: "Curso/Oficina",
    EVENT: "Evento",
    LECTURE: "Palestra",
    OTHER: "Outros",
  };

  const status = statusConfig[action.status] || {
    label: action.status || "Indisponível",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Data indefinida";
    return new Date(isoString).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group flex flex-col">
      <div className="relative h-48 overflow-hidden shrink-0">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400"
          alt={action.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-1 space-y-3">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-2" title={action.title}>
          {action.title}
        </h3>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="size-4 shrink-0 mt-0.5 text-gray-400" />
          <span className="line-clamp-1">{action.campus || "Campus não informado"}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="size-4 shrink-0 text-gray-400" />
          <span>{formatDate(action.startDate)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="size-4 shrink-0 text-gray-400" />
          <span>{action.availableSlots} vagas disponíveis</span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700 capitalize">
            {typeMap[action.type] || action.type}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <Link
          to={`/activity/${action.id}`}
          className="mt-auto block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ border: "1px solid #00579A", color: "#00579A" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#00579A";
            (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "#00579A";
          }}
        >
          Ver Detalhes
        </Link>
      </div>
    </div>
  );
}
