import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      className = "",
      id,
      maxLength,
      value,
      defaultValue,
      onChange,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const hasCounter = maxLength !== undefined;
    const counterId = `${textareaId}-counter`;

    const [uncontrolledLength, setUncontrolledLength] = React.useState(() =>
      String(defaultValue ?? "").length,
    );

    const currentLength =
      value !== undefined ? String(value).length : uncontrolledLength;

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (value === undefined) {
        setUncontrolledLength(event.target.value.length);
      }
      onChange?.(event);
    };

    const describedBy = hasCounter
      ? [ariaDescribedBy, counterId].filter(Boolean).join(" ")
      : ariaDescribedBy;

    const isAtLimit = hasCounter && currentLength >= maxLength;
    const isNearLimit =
      hasCounter && !isAtLimit && currentLength * 10 >= maxLength * 9;

    const counterColorClass = isAtLimit
      ? "text-red-500"
      : isNearLimit
        ? "text-amber-600"
        : "text-gray-500";

    return (
      <div>
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-2 block text-sm font-medium text-gray-900"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-describedby={describedBy}
          className={`w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
              : "border-gray-300 focus:border-[#072C59] focus:ring-4 focus:ring-[#072C59]/10"
          } ${className}`}
          {...props}
        />

        {hasCounter ? (
          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              {helperText && !error ? (
                <p className="text-sm text-gray-500">{helperText}</p>
              ) : null}
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
            </div>

            <p
              id={counterId}
              className={`shrink-0 text-right text-sm ${counterColorClass}`}
            >
              {currentLength}/{maxLength}
            </p>

            <span className="sr-only" aria-live="polite">
              {isAtLimit ? `Limite de ${maxLength} caracteres atingido.` : ""}
            </span>
          </div>
        ) : (
          <>
            {helperText && !error ? (
              <p className="mt-1 text-sm text-gray-500">{helperText}</p>
            ) : null}
            {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
          </>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";