import { CloudOff, SearchX } from "lucide-react";

interface SigaaFeedFallbackProps {
  variant: "error" | "empty";
  onRetry: () => void;
  onExploreHelpa: () => void;
}

const COPY = {
  error: {
    eyebrow: "Falha ao carregar",
    title: "Não foi possível carregar as ações do SIGAA",
    description:
      "Tente novamente em instantes. As ações da comunidade no Helpa continuam disponíveis.",
  },
  empty: {
    eyebrow: "Nenhum resultado",
    title: "Nenhuma ação do SIGAA encontrada",
    description:
      "Nenhuma ação corresponde a esses filtros. Tente ajustar a busca.",
  },
} as const;

export function SigaaFeedFallback({
  variant,
  onRetry,
  onExploreHelpa,
}: SigaaFeedFallbackProps) {
  const copy = COPY[variant];
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
        {copy.eyebrow}
      </p>

      <h3 className="text-xl font-bold text-gray-900">{copy.title}</h3>

      <p className="max-w-md text-sm text-gray-600">{copy.description}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {isError && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-[#1B75BB] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
          >
            Tentar de novo
          </button>
        )}

        <button
          type="button"
          onClick={onExploreHelpa}
          className="rounded-lg border border-[#1B75BB] px-5 py-2.5 text-sm font-semibold text-[#1B75BB] transition-colors hover:bg-blue-50 cursor-pointer"
        >
          Explorar ações no Helpa
        </button>
      </div>
    </div>
  );
}
