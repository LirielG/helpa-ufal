import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  content: string;
}

export function Tooltip({ content }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current && tooltipRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      const top = buttonRect.bottom + 12;
      const left = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;

      setPosition({ top, left });
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="size-6 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition"
      >
        <HelpCircle className="size-4 text-gray-400" />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-slate-900 text-white rounded-lg p-4 shadow-lg max-w-xs"
          style={{
            top: position.top,
            left: position.left,
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex gap-3">
            <div className="size-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="text-slate-900 font-bold text-sm">?</span>
            </div>
            <p className="text-sm leading-relaxed">{content}</p>
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-slate-900"></div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
