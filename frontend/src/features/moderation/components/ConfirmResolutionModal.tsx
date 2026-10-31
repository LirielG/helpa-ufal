import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useDialog } from "@/hooks/useDialog";
import type { Report } from "@/services/contracts/report";
import { resolveReport } from "../services";
import { resolveReportResolutionError } from "../errors";

interface ConfirmResolutionModalProps {
  report: Report;
  onClose: () => void;
  onResolved: (resolved: Report) => void;
  onNotFound: (reportId: string, message: string) => void;
}

export function ConfirmResolutionModal({
  report,
  onClose,
  onResolved,
  onNotFound,
}: ConfirmResolutionModalProps) {
  const titleId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{
    text: string;
    canRetry: boolean;
  } | null>(null);
  const inFlight = useRef(false);

  const dialogRef = useDialog({ onClose, closeDisabled: isSubmitting });

  const handleConfirm = async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const updated = await resolveReport(report.id);
      onResolved(updated);
    } catch (error) {
      const resolution = resolveReportResolutionError(error);

      switch (resolution.kind) {
        case "sessionExpired":
          break;
        case "notFound":
          onNotFound(report.id, resolution.text);
          break;
        case "message":
          setSubmitError({
            text: resolution.text,
            canRetry: resolution.canRetry,
          });
          break;
        default: {
          const exhaustive: never = resolution;
          return exhaustive;
        }
      }
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const isConfirmBlocked = submitError !== null && !submitError.canRetry;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl bg-[#FFFDFB] p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl gap-5 border border-gray-100"
      >
        <div className="bg-[#0066FF] rounded-lg p-2.5 flex items-center justify-center">
          <Check className="size-7 text-white stroke-[3]" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 id={titleId} className="text-2xl font-bold text-[#072C59]">
            Confirmar resolução
          </h2>
          <p className="text-sm text-gray-700 max-w-xs mx-auto leading-relaxed">
            Você tem certeza que gostaria de resolver esta denúncia?
          </p>
        </div>

        <div className="bg-[#FBE8C2] border border-[#BCA371] rounded-xl px-4 py-3.5 text-sm text-gray-900 text-left w-full leading-relaxed">
          <strong>Atenção:</strong> Ao confirmar, você está ciente que após a
          resolução da denúncia ela não poderá ser reaberta.
        </div>

        {submitError && (
          <div
            role="alert"
            className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-left text-red-800"
          >
            {submitError.text}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 w-full pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-2xl bg-[#B91C1C] hover:bg-red-800 py-3 px-6 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]"
          >
            Não
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || isConfirmBlocked}
            className="flex-1 rounded-2xl bg-[#0066FF] hover:bg-blue-700 py-3 px-6 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066FF]"
          >
            {isSubmitting ? "Resolvendo..." : "Sim"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
