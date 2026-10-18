import { CloudOff, SearchX } from "lucide-react";

export interface FeedFallbackAction {
  label: string;
  onClick: () => void;
}

export interface FeedFallbackProps {
  variant: "error" | "empty";
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: FeedFallbackAction;
  secondaryAction?: FeedFallbackAction;
}

export function FeedFallback({
  variant,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
}: FeedFallbackProps) {
  const isError = variant === "error";
  const Icon = isError ? CloudOff : SearchX;

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white px-6 py-16 flex flex-col items-center text-center gap-3">
      <div
        className={`size-16 rounded-full flex items-center justify-center ${
          isError ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-400"
        }`}
      >
        <Icon className="size-7" aria-hidden="true" />
      </div>

      <p
        className={`text-sm font-medium ${
          isError ? "text-yellow-700" : "text-gray-500"
        }`}
      >
        {eyebrow}
      </p>

      <h3 className="text-xl font-bold text-gray-900">{title}</h3>

      <p className="max-w-md text-sm text-gray-600">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="rounded-lg bg-[#1B75BB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-lg border border-[#1B75BB] px-5 py-2.5 text-sm font-semibold text-[#1B75BB] transition-colors hover:bg-blue-50 cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
