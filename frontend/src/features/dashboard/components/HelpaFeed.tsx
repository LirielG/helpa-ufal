import { Pagination } from "../../../components/Pagination";
import type { ActivityListItem } from "@/services/contracts/activity";
import type { FilterOptions } from "../types";
import { ActionGrid } from "./ActionGrid";
import { FilterBar } from "./FilterBar";
import { FeedFallback } from "../../../components/FeedFallback";

interface HelpaFeedProps {
  actions: ActivityListItem[];
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
  onResetFilters: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

const HELPA_FEED_COPY = {
  error: {
    eyebrow: "Falha ao carregar",
    title: "Não foi possível carregar as ações",
    description: "Verifique sua conexão e tente novamente em instantes.",
  },
  emptyFiltered: {
    eyebrow: "Nenhum resultado",
    title: "Nenhuma ação encontrada",
    description: "Nenhuma ação corresponde a esses filtros.",
  },
  emptyUnfiltered: {
    eyebrow: "Nenhum resultado",
    title: "Nenhuma ação cadastrada",
    description: "Ainda não há ações publicadas no Helpa.",
  },
  searchDescription: (term: string) =>
    `Nenhuma ação encontrada para "${term}".`,
  retry: "Tentar de novo",
  clearFilters: "Limpar filtros",
} as const;

export function HelpaFeed({
  actions,
  filters,
  onFilterChange,
  onResetFilters,
  page,
  totalPages,
  onPageChange,
  isLoading,
  hasError,
  onRetry,
}: HelpaFeedProps) {
  const search = filters.search?.trim();

  const hasActiveFilters =
    Boolean(search) ||
    filters.area !== "all" ||
    filters.actionType !== "all" ||
    filters.status !== "all";

  const emptyCopy = hasActiveFilters
    ? HELPA_FEED_COPY.emptyFiltered
    : HELPA_FEED_COPY.emptyUnfiltered;

  return (
    <div className="flex flex-col gap-8">
      <FilterBar filters={filters} onFilterChange={onFilterChange} />

      {isLoading && (
        <p className="text-center text-gray-500 py-10 font-medium">
          Buscando ações...
        </p>
      )}

      {!isLoading && hasError && (
        <FeedFallback
          variant="error"
          eyebrow={HELPA_FEED_COPY.error.eyebrow}
          title={HELPA_FEED_COPY.error.title}
          description={HELPA_FEED_COPY.error.description}
          primaryAction={{ label: HELPA_FEED_COPY.retry, onClick: onRetry }}
        />
      )}

      {!isLoading && !hasError && actions.length === 0 && (
        <FeedFallback
          variant="empty"
          eyebrow={emptyCopy.eyebrow}
          title={emptyCopy.title}
          description={
            search
              ? HELPA_FEED_COPY.searchDescription(search)
              : emptyCopy.description
          }
          primaryAction={
            hasActiveFilters
              ? { label: HELPA_FEED_COPY.clearFilters, onClick: onResetFilters }
              : undefined
          }
        />
      )}

      {!isLoading && !hasError && actions.length > 0 && (
        <>
          <ActionGrid actions={actions} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
