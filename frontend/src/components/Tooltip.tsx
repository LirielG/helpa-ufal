import { useState, useRef } from "react";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="size-5 rounded-full bg-[#0B2B58] flex items-center justify-center hover:opacity-90 transition"
      >
        <HelpCircle className="size-3.5 text-white" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Fechar informação"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-[650px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <div className="h-[72px] bg-[#0B2B58] px-6 flex items-start pt-5">
              <div className="size-9 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-base font-semibold leading-none">?</span>
              </div>
            </div>

            <div className="px-10 py-10 text-center">
              <p className="text-[24px] leading-[1.32] font-normal text-[#1A1A1A] tracking-[-0.01em]">
                {content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
