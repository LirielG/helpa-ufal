import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="mb-2 block text-sm font-medium text-gray-900">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          className={`w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
              : "border-gray-300 focus:border-[#072C59] focus:ring-4 focus:ring-[#072C59]/10"
          } ${className}`}
          {...props}
        />

        {helperText && !error ? <p className="mt-1 text-sm text-gray-500">{helperText}</p> : null}
        {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";