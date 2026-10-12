import { Calendar, MapPin, Clock, Check, X } from "lucide-react";
import type { ActivityStatusTransition, UserActivity } from "../../types";

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
  const isCompleted = pendingStatus === "COMPLETED";

  return (
    <div
      role="dialog"
      aria-label={isCompleted ? "Concluir ação" : "Cancelar ação"}
      className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col items-center text-center shadow-2xl gap-4">
        {isCompleted ? (
          <div className="bg-green-600 rounded-md p-1.5 flex items-center justify-center">
            <Check className="size-6 text-white stroke-[3]" />
          </div>
        ) : (
          <div className="border-2 border-red-600 rounded-full p-1.5 flex items-center justify-center">
            <X className="size-6 text-red-600 stroke-[3]" />
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold text-[#0A2540]">
            {isCompleted ? "Concluir ação" : "Cancelar ação"}
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            {isCompleted
              ? "Você está prestes a confirmar a conclusão da ação:"
              : "Você está prestes a cancelar a ação:"}
          </p>
        </div>

        <div className="bg-gray-100/80 rounded-xl p-4 w-full text-left flex flex-col gap-2">
          <h4 className="font-bold text-[#0A2540] text-sm">{activity.title}</h4>
          <div className="flex flex-col gap-1 text-xs text-gray-700 font-medium">
            <span className="flex items-center gap-2">
              <Calendar className="size-3.5 text-gray-800" />
              {activity.date}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-3.5 text-gray-800" />
              {activity.location}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-3.5 text-gray-800" />
              {activity.workloadHours ?? 40} horas
            </span>
          </div>
        </div>

        <div className="bg-[#FFF8E7] border border-[#F5E0B3] rounded-xl p-3 text-xs text-gray-800 text-left w-full leading-relaxed">
          <strong>Atenção:</strong> Ao confirmar, você está ciente que a ação
          não poderá ser reaberta. Os inscritos não serão avisados
          automaticamente.
        </div>

        <div className="flex items-center justify-between gap-3 w-full mt-1">
          <button
            type="button"
            onClick={onCancel}
            aria-label={isCompleted ? "Voltar" : "Manter ação"}
            className="bg-[#C81A17] hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex-1 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            aria-label={isCompleted ? "Concluir ação" : "Cancelar ação"}
            className="bg-[#0066FF] hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex-1 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isCompleted ? "Confirmar" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
