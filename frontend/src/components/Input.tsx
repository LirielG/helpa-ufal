import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  labelIcon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, icon, labelIcon, trailing, className = "", id, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div>
        {label && (
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor={inputId} className="block text-sm font-medium">
              {label}
            </label>
            {labelIcon}
          </div>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full ${icon ? "pl-12" : "pl-4"} ${
              trailing ? "pr-12" : "pr-4"
            } py-3 border ${
              error
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            } rounded-lg outline-none focus:ring-2 transition disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
          {trailing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-gray-400">
              {trailing}
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
