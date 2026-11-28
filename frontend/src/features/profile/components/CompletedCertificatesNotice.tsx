import { Info } from "lucide-react";
import { COMPLETED_CERTIFICATES_NOTICE } from "@/features/home/constants/howItWorks";

interface CompletedCertificatesNoticeProps {
  onOpenHowItWorks: () => void;
}

export function CompletedCertificatesNotice({
  onOpenHowItWorks,
}: CompletedCertificatesNoticeProps) {
  return (
    <div
      role="note"
      aria-label="Sobre os seus certificados"
      className="bg-[#ECEEF0] rounded-lg p-4 flex items-start gap-3 text-left"
    >
      <Info
        className="size-5 text-[#C00F0C] shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="text-xs sm:text-sm text-[#1E1E1E] leading-relaxed space-y-0.5">
        <p className="font-medium text-[#000A1E]">
          {COMPLETED_CERTIFICATES_NOTICE.title}
        </p>
        <p>{COMPLETED_CERTIFICATES_NOTICE.description}</p>
        <p>
          {COMPLETED_CERTIFICATES_NOTICE.linkPrefix}
          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="underline font-medium text-[#000A1E] hover:text-[#00579A] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] rounded-xs"
          >
            {COMPLETED_CERTIFICATES_NOTICE.linkLabel}
          </button>
        </p>
      </div>
    </div>
  );
}
