import React from "react";
import { ChevronDown } from "lucide-react";
import { COMPACT_FIELD_LABEL, type FieldSize } from "./fieldSize";

const SIZE_STYLES: Record<FieldSize, string> = {
  sm: "py-2.5 text-xs",
  md: "py-3 text-sm",
};

// `size` is overridden: the native attribute turns the select into a list box,
// which no screen here uses, while the density variant is needed everywhere.
interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  size?: FieldSize;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, icon, options, size = "md", className = "", id, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const compact = size === "sm";

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"}`}>
        {label && (
          <label
            htmlFor={selectId}
            className={
              compact ? COMPACT_FIELD_LABEL : "text-xs text-gray-500 font-normal"
            }
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-lg ${
              icon ? "pl-12" : compact ? "pl-2" : "px-4"
            } ${compact ? "pr-8" : "pr-10"} ${SIZE_STYLES[size]} text-gray-800 bg-[rgba(196,198,207,0.2)] border ${
              error
                ? "border-red-300 focus:ring-red-500"
                : "border-[#C4C6CF] focus:ring-blue-400"
            } focus:outline-none focus:ring-2 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className={`absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none ${
              compact ? "right-2 size-4" : "right-3 size-5"
            }`}
          />
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
