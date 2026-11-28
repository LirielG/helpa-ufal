import { useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialog } from "@/hooks/useDialog";
import {
  HELPA_JOURNEY_STEPS,
  HELPA_JOURNEY_TITLE,
} from "@/features/home/constants/howItWorks";

interface CertificateFlowModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Renders the dialog only while open so focus restoration and scroll locking
 * run cleanly for each open/close cycle.
 */
export function CertificateFlowModal({
  open,
  onClose,
}: CertificateFlowModalProps) {
  return open ? <CertificateFlowDialog onClose={onClose} /> : null;
}

function CertificateFlowDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useDialog({ onClose });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[540px] max-h-[90dvh] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="bg-[linear-gradient(92.87deg,#00579A_18.7%,#001D34_85.37%)] px-6 py-5 text-white relative shrink-0">
          <h2
            id={titleId}
            className="text-lg sm:text-xl font-bold leading-snug pr-8"
          >
            {HELPA_JOURNEY_TITLE}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4 overflow-y-auto">
          {HELPA_JOURNEY_STEPS.map((step) => (
            <div key={step.number} className="space-y-1">
              <h3 className="text-sm sm:text-[15px] font-bold text-[#1E1E1E]">
                {step.number}. {step.title}
              </h3>
              <p className="text-sm text-[#44474E] leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
