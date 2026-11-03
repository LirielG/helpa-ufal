import React from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "lucide-react";
import "react-day-picker/style.css";
import {
  INVALID_DATE_MESSAGE,
  displayToISO,
  formatISODate,
  isoToDisplay,
  maskDate,
  parseISODate,
} from "../utils/dateField";

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;

export interface DatePickerProps {
  /** `aaaa-mm-dd`, as the form stores it; empty when there is no date. */
  value: string;
  onChange: (value: string) => void;
  /** `aaaa-mm-dd`. Earlier days are disabled in the calendar. */
  min?: string;
  id?: string;
  "aria-label"?: string;
  /** Message from the form, shown under the field. */
  error?: string;
  /** Marks the field invalid without showing a message under it. */
  invalid?: boolean;
  className?: string;
}

/**
 * Date field that always reads `dd/mm/aaaa` with a pt-BR calendar, instead of
 * the native `type="date"` drawn in the browser's or OS's locale.
 */
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      min,
      id,
      "aria-label": ariaLabel,
      error,
      invalid,
      className = "",
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    const [text, setText] = React.useState(() => isoToDisplay(value));
    const [prevValue, setPrevValue] = React.useState(value);
    const [touched, setTouched] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [coords, setCoords] = React.useState<{ top: number; left: number }>({
      top: 0,
      left: 0,
    });
    const rootRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    // A value that changes from outside (form reset) replaces what is typed.
    if (value !== prevValue) {
      setPrevValue(value);
      if (displayToISO(text) !== value) setText(isoToDisplay(value));
    }

    const updatePosition = React.useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth || 312;
      const popoverHeight = popoverRef.current?.offsetHeight || 340;

      const maxLeft = window.innerWidth - popoverWidth - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));

      const belowTop = rect.bottom + POPOVER_GAP;
      const aboveTop = rect.top - popoverHeight - POPOVER_GAP;
      const fitsBelow =
        belowTop + popoverHeight <= window.innerHeight - VIEWPORT_MARGIN;
      const fitsAbove = aboveTop >= VIEWPORT_MARGIN;

      const unclampedTop = !fitsBelow && fitsAbove ? aboveTop : belowTop;
      const maxTop = window.innerHeight - popoverHeight - VIEWPORT_MARGIN;
      const top = Math.max(VIEWPORT_MARGIN, Math.min(unclampedTop, maxTop));

      setCoords({ top, left });
    }, []);

    React.useLayoutEffect(() => {
      if (!open) return;
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [open, updatePosition]);

    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          !rootRef.current?.contains(target) &&
          !popoverRef.current?.contains(target)
        ) {
          setOpen(false);
        }
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          buttonRef.current?.focus();
        }
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open]);

    const minDate = min ? parseISODate(min) : undefined;
    const selected = parseISODate(value);

    const incomplete = text.length > 0 && displayToISO(text) === undefined;
    const localError =
      incomplete && (touched || text.length === 10)
        ? INVALID_DATE_MESSAGE
        : undefined;
    const message = localError ?? error;

    const commit = (iso: string) => {
      setPrevValue(iso);
      onChange(iso);
    };

    return (
      <div ref={rootRef} className="relative">
        <div ref={triggerRef} className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            aria-label={ariaLabel}
            aria-invalid={message || invalid ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            value={text}
            onChange={(e) => {
              const masked = maskDate(e.target.value);
              setText(masked);
              commit(displayToISO(masked) ?? "");
            }}
            onBlur={() => setTouched(true)}
            className={`w-full border rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 bg-white text-gray-700 placeholder:text-gray-400 ${
              message || invalid
                ? "border-red-400 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            } ${className}`}
          />
          <button
            ref={buttonRef}
            type="button"
            aria-label={`Abrir calendário${ariaLabel ? `: ${ariaLabel}` : ""}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Calendar size={18} aria-hidden="true" />
          </button>
        </div>

        {open &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Calendário"
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-60 bg-white border border-gray-200 rounded-lg shadow-lg p-2"
            >
              <DayPicker
                mode="single"
                locale={ptBR}
                selected={selected}
                defaultMonth={selected ?? minDate}
                disabled={minDate ? { before: minDate } : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  setText(isoToDisplay(formatISODate(date)));
                  commit(formatISODate(date));
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                autoFocus
              />
            </div>,
            document.body,
          )}

        {message && (
          <p id={errorId} className="text-red-500 text-sm mt-1">
            {message}
          </p>
        )}
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";
