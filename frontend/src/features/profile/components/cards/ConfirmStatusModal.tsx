import { Calendar, MapPin, Clock, Check, X, Play } from "lucide-react";
import type { ActivityStatusTransition, UserActivity } from "../../types";
import { formatWorkloadHours } from "@/utils";

// The cancel title must not be "Confirmar cancelamento", which the enrollment
// cancellation modal uses.

const STATUS_MODAL_COPY: Record<
  ActivityStatusTransition,
  {
    title: string;
    subtitle: string;
    body: string;
    backOut: string;
  }
> = {
  IN_PROGRESS: {
    title: "Iniciar ação",
    subtitle: "Você está prestes a iniciar a ação:",
    body: "A ação passa a constar como em andamento. Novas inscrições deixam de ser aceitas.",
    backOut: "Voltar",
  },
  COMPLETED: {
    title: "Concluir ação",
    subtitle: "Você está prestes a confirmar a conclusão da ação:",
    body: "Depois de concluída, a ação não poderá voltar a ficar em andamento.",
    backOut: "Voltar",
  },
  CANCELLED: {
    title: "Cancelar ação",
    subtitle: "Você está prestes a cancelar a ação:",
    body: "A ação continuará visível, marcada como cancelada, e não poderá ser reaberta. Os inscritos não serão avisados automaticamente.",
    backOut: "Manter ação",
  },
};

type ConfirmStatusModalProps = {
  activity: UserActivity;
  pendingStatus: ActivityStatusTransition;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmStatusModal({
  activity,
  pendingStatus,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmStatusModalProps) {
  const copy = STATUS_MODAL_COPY[pendingStatus];
  const workloadHours = activity.action.details?.workloadHours;

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col items-center text-center shadow-2xl gap-4">
        {pendingStatus === "IN_PROGRESS" && (
          <div className="bg-[#1B75BB] rounded-md p-1.5 flex items-center justify-center">
            <Play className="size-6 text-white fill-white" />
          </div>
        )}

        {pendingStatus === "COMPLETED" && (
          <div className="bg-green-600 rounded-md p-1.5 flex items-center justify-center">
            <Check className="size-6 text-white stroke-[3]" />
          </div>
        )}

        {pendingStatus === "CANCELLED" && (
          <div className="border-2 border-red-600 rounded-full p-1.5 flex items-center justify-center">
            <X className="size-6 text-red-600 stroke-[3]" />
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold text-[#0A2540]">{copy.title}</h3>
          <p className="text-xs text-gray-600 mt-1">{copy.subtitle}</p>
        </div>

        <div className="bg-gray-100/80 rounded-xl p-4 w-full text-left flex flex-col gap-2">
          <h4 className="font-bold text-[#0A2540] text-sm">
            {activity.action.title}
          </h4>
          <div className="flex flex-col gap-1 text-xs text-gray-700 font-medium">
            <span className="flex items-center gap-2">
              <Calendar className="size-3.5 text-gray-800" />
              {activity.date}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-3.5 text-gray-800" />
              {activity.location}
            </span>
            {workloadHours !== undefined && (
              <span className="flex items-center gap-2">
                <Clock className="size-3.5 text-gray-800" />
                {formatWorkloadHours(workloadHours)}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#FFF8E7] border border-[#F5E0B3] rounded-xl p-3 text-xs text-gray-800 text-left w-full leading-relaxed">
          <strong>Atenção:</strong> {copy.body}
        </div>

        <div className="flex items-center justify-between gap-3 w-full mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium py-2.5 px-4 rounded-xl text-xs flex-1 transition-colors cursor-pointer"
          >
            {copy.backOut}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${
              pendingStatus === "CANCELLED"
                ? "bg-[#0066FF] hover:bg-blue-700"
                : "bg-[#C81A17] hover:bg-red-700"
            } text-white font-medium py-2.5 px-4 rounded-xl text-xs flex-1 transition-colors disabled:opacity-50 cursor-pointer`}
          >
            {copy.title}
          </button>
        </div>
      </div>
    </div>
  );
}
