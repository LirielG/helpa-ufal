import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  BookOpen,
  Users,
} from "lucide-react";
import type { ActionDetail } from "../types";

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
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Informações</h2>

      <ul className="space-y-4">
        <InfoRow
          icon={<Building2 className="size-5 text-gray-400" />}
          label="Instituição"
        >
          <span className="font-medium text-gray-900">
            {action.institution}
          </span>
        </InfoRow>

        <InfoRow
          icon={<MapPin className="size-5 text-gray-400" />}
          label="Local"
        >
          <span className="font-medium text-gray-900">{action.city}</span>
          <span className="text-gray-500 text-sm">{action.venue}</span>
        </InfoRow>

        <InfoRow
          icon={<Calendar className="size-5 text-gray-400" />}
          label="Período"
        >
          <span className="font-medium text-gray-900">
            {action.startDate} - {action.endDate}
          </span>
        </InfoRow>

        <InfoRow
          icon={<Clock className="size-5 text-gray-400" />}
          label="Horário"
        >
          <span className="font-medium text-gray-900">{action.schedule}</span>
        </InfoRow>

        <InfoRow
          icon={<BookOpen className="size-5 text-gray-400" />}
          label="Carga Horária"
        >
          <span className="font-medium text-gray-900">
            {action.workloadHours} horas
          </span>
        </InfoRow>

        <InfoRow
          icon={<Users className="size-5 text-gray-400" />}
          label="Vagas"
        >
          <span className="font-medium text-gray-900">
            {action.slots}/{action.totalSlots} vagas
          </span>
        </InfoRow>
      </ul>
    </div>
  );
}
