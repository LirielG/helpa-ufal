import { AlertCircle } from "lucide-react";
import { Button } from "../../../components/Button";
import { ACTION_FORMAT_LABELS } from "../../dashboard/constants";

interface ConfirmFormatModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmFormatModal({
  isOpen,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmFormatModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-format-title"
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6"
      >
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-600 border-2 border-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3
            id="confirm-format-title"
            className="text-2xl font-bold text-[#0A2240]"
          >
            Confirmar alteração
          </h3>
          <p className="text-sm text-gray-600 leading-snug">
            Você está prestes a alterar o formato da ação para{" "}
            <span className="font-semibold text-gray-800">
              {ACTION_FORMAT_LABELS.ONLINE}
            </span>
            .
          </p>
        </div>

        <div className="bg-[#FFF9E6] border border-[#FFE0B2] rounded-2xl p-4 text-left text-xs text-gray-800 leading-relaxed shadow-sm">
          <p>
            <strong className="font-bold text-gray-900">Atenção:</strong> Ao
            confirmar, você está ciente de que os dados de endereço
            anteriormente associados a esta ação serão excluídos.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            rounded
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-full bg-[#486B8E] hover:bg-[#3B5977] text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            rounded
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-full bg-[#0A2240] hover:bg-[#06182E] text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? "Salvando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
