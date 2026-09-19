import React from "react";
import { COMPACT_FIELD_LABEL, type FieldSize } from "./fieldSize";

const SIZE_STYLES: Record<FieldSize, string> = {
  sm: "py-2.5 text-xs",
  md: "py-3",
};

// `size` is overridden: the native attribute measures the input in characters,
// which no screen here uses, while the density variant is needed everywhere.
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  labelIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  size?: FieldSize;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      icon,
      labelIcon,
      trailing,
      size = "md",
      className = "",
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const paddingX =
      size === "sm"
        ? `${icon ? "pl-9" : "pl-2"} ${trailing ? "pr-9" : "pr-2"}`
        : `${icon ? "pl-12" : "pl-4"} ${trailing ? "pr-12" : "pr-4"}`;

    return (
      <div>
        {label && (
          <div
            className={`flex items-center gap-2 ${size === "sm" ? "mb-1" : "mb-2"}`}
          >
            <label
              htmlFor={inputId}
              className={`block ${size === "sm" ? COMPACT_FIELD_LABEL : "text-sm font-medium"}`}
            >
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
            className={`w-full ${paddingX} ${SIZE_STYLES[size]} border ${
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
