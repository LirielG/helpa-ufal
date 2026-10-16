import { X } from "lucide-react";

type DeleteActionModalProps = {
  isSuccess: boolean;
  onConfirmDelete: () => void;
  onClose: () => void;
};

export function DeleteActionModal({
  isSuccess,
  onConfirmDelete,
  onClose,
}: DeleteActionModalProps) {
  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-xs">
        <div className="bg-white rounded-2xl w-full max-w-xs p-6 flex flex-col items-center text-center shadow-2xl gap-4">
          <div className="bg-red-600 rounded-lg p-2 flex items-center justify-center">
            <X className="size-6 text-white stroke-[3]" />
          </div>
          <h3 className="text-lg font-bold text-[#0A2540]">
            Sua ação foi excluída
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="bg-[#0066FF] hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl text-xs w-full transition-colors cursor-pointer mt-2"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-[#FFF8F8] rounded-2xl w-full max-w-sm p-6 flex flex-col items-center text-center shadow-2xl gap-4 border border-red-100">
        <div className="border-2 border-red-600 rounded-full p-2 flex items-center justify-center">
          <X className="size-7 text-red-600 stroke-[3]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#0A2540]">
            Confirmar exclusão
          </h3>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-[240px] mx-auto">
            Você tem certeza que gostaria de excluir esta ação?
          </p>
        </div>
        <div className="bg-[#FFF8E7] border border-[#F5E0B3] rounded-xl p-3 text-xs text-gray-800 text-left w-full leading-relaxed">
          <strong>Atenção:</strong> Ao confirmar, você está ciente que a ação
          será completamente excluída e não terá como recorrer.
        </div>
        <div className="flex items-center justify-between gap-4 w-full mt-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#C81A17] hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-xl text-xs flex-1 transition-colors cursor-pointer"
          >
            Não
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            className="bg-[#0066FF] hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl text-xs flex-1 transition-colors cursor-pointer"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}
