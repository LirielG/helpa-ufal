import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /**
   * Shows the character counter. An uncontrolled field is recounted on typing
   * and on every render, which covers react-hook-form's `reset`. `setValue`
   * alone renders nothing, so a form that calls it must also pass `value`.
   */
  maxLength?: number;
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
    const counterId = React.useId();

    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(
      ref,
      () => textareaRef.current as HTMLTextAreaElement,
      [],
    );

    const [uncontrolledLength, setUncontrolledLength] = React.useState(
      () => String(defaultValue ?? "").length,
    );

    // react-hook-form writes the value through the ref, with no change event.
    // Must stay below useImperativeHandle: that is where the form gets the ref
    // and writes its value. It cannot loop: an unchanged length renders nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useLayoutEffect(() => {
      if (!hasCounter || !textareaRef.current) return;
      setUncontrolledLength(textareaRef.current.value.length);
    });

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
          ref={textareaRef}
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
            {error ? (
              <p className="mt-1 text-sm text-red-500">{error}</p>
            ) : null}
          </>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
