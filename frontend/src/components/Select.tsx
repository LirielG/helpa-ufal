import React from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, icon, options, className = "", id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs text-gray-500 font-normal"
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
              icon ? "pl-12" : "px-4"
            } py-3 pr-10 text-sm text-gray-800 bg-[rgba(196,198,207,0.2)] border ${
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
            className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none"
          />
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";
