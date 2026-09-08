import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  BookOpen,
  Users,
} from "lucide-react";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../../dashboard/constants";
import type { ActionDetail } from "../types";
import { formatDate, formatTime } from "../../../utils";

interface ActionInfoCardProps {
  action: ActionDetail;
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-gray-400 mb-0.5">{label}</span>
        {children}
      </div>
    </li>
  );
}

export function ActionInfoCard({ action }: ActionInfoCardProps) {
  const format = action.details?.format;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Informações</h2>

      <ul className="space-y-4">
        <InfoRow
          icon={<Building2 className="size-5 text-gray-400" />}
          label="Campus / Instituição"
        >
          <span className="font-medium text-gray-900">
            {ACTION_CAMPUS_LABELS[action.campus] ?? "Não informado"}
          </span>
        </InfoRow>

        <InfoRow
          icon={<MapPin className="size-5 text-gray-400" />}
          label="Local / Formato"
        >
          <span className="font-medium text-gray-900">
            {action.details?.address
              ? `${action.details.address.city} - ${action.details.address.state}`
              : format
                ? ACTION_FORMAT_LABELS[format]
                : "Não informado"}
          </span>
          <span className="text-gray-500 text-sm">
            {action.details?.address?.addressLine || "Endereço não informado"}
          </span>
        </InfoRow>

        <InfoRow
          icon={<Calendar className="size-5 text-gray-400" />}
          label="Período"
        >
          <span className="font-medium text-gray-900">
            {formatDate(action.startDate)} a {formatDate(action.endDate)}
          </span>
        </InfoRow>

        <InfoRow
          icon={<Clock className="size-5 text-gray-400" />}
          label="Horário"
        >
          <span className="font-medium text-gray-900">
            {formatTime(action.startDate)} às {formatTime(action.endDate)}
          </span>
        </InfoRow>

        <InfoRow
          icon={<BookOpen className="size-5 text-gray-400" />}
          label="Carga Horária"
        >
          <span className="font-medium text-gray-900">
            {action.details?.workloadHours || 0} horas
          </span>
        </InfoRow>

        <InfoRow
          icon={<Users className="size-5 text-gray-400" />}
          label="Vagas"
        >
          <span className="font-medium text-gray-900">
            {action.availableSlots} disponíveis / {action.slots} no total
          </span>
        </InfoRow>
      </ul>
    </div>
  );
}
