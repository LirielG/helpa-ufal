import React from "react";
import { maskTime } from "../utils/dateField";

export interface TimeInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  /** `hh:mm`, 24h, as the form stores it. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * 24h `hh:mm` field. A text input with a mask rather than `type="time"`,
 * which the browser draws in the OS locale (with AM/PM in some of them).
 */
export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ value, onChange, error, className = "", id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          maxLength={5}
          value={value ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(maskTime(e.target.value))}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 bg-white text-gray-700 placeholder:text-gray-400 ${
            error
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          } ${className}`}
        />
        {error && (
          <p id={errorId} className="text-red-500 text-sm mt-1">
            {error}
          </p>
        )}
      </div>
    );
  },
);

TimeInput.displayName = "TimeInput";
