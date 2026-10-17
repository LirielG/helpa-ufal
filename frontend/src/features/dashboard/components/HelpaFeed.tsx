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
  onResetFilters?: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

const HELPA_FEED_COPY = {
  error: {
    eyebrow: "Falha ao carregar",
    title: "Não foi possível carregar as ações",
    description: "Não foi possível carregar as ações. Tente novamente.",
  },
  emptyFiltered: {
    eyebrow: "Nenhum resultado",
    title: "Nenhuma ação encontrada",
    description: "Nenhuma ação corresponde a esses filtros.",
  },
  emptyUnfiltered: {
    eyebrow: "Nenhum resultado",
    title: "Nenhuma ação cadastrada",
    description: "Nenhuma ação encontrada com esses filtros.",
  },
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
  error,
  onRetry,
}: HelpaFeedProps) {
  const search = filters.search?.trim();

  const hasActiveFilters =
    Boolean(search) ||
    (Boolean(filters.area) && filters.area !== "all") ||
    (Boolean(filters.actionType) && filters.actionType !== "all") ||
    (Boolean(filters.availability) && filters.availability !== "all");

  const handleClearFilters = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      onFilterChange("search", "");
      onFilterChange("area", "all");
      onFilterChange("actionType", "all");
      onFilterChange("availability", "all");
    }
  };

  const emptyDescription = search
    ? `Nenhuma ação encontrada para "${search}".`
    : hasActiveFilters
      ? HELPA_FEED_COPY.emptyFiltered.description
      : HELPA_FEED_COPY.emptyUnfiltered.description;

  return (
    <div className="flex flex-col gap-8">
      <FilterBar filters={filters} onFilterChange={onFilterChange} />

      {isLoading && (
        <p className="text-center text-gray-500 py-10 font-medium">
          Buscando ações...
        </p>
      )}

      {!isLoading && error && (
        <FeedFallback
          variant="error"
          eyebrow={HELPA_FEED_COPY.error.eyebrow}
          title={HELPA_FEED_COPY.error.title}
          description={HELPA_FEED_COPY.error.description}
          primaryAction={
            onRetry
              ? {
                  label: "Tentar de novo",
                  onClick: onRetry,
                }
              : undefined
          }
        />
      )}

      {!isLoading && !error && actions.length === 0 && (
        <FeedFallback
          variant="empty"
          eyebrow={
            hasActiveFilters
              ? HELPA_FEED_COPY.emptyFiltered.eyebrow
              : HELPA_FEED_COPY.emptyUnfiltered.eyebrow
          }
          title={
            hasActiveFilters
              ? HELPA_FEED_COPY.emptyFiltered.title
              : HELPA_FEED_COPY.emptyUnfiltered.title
          }
          description={emptyDescription}
          primaryAction={
            hasActiveFilters
              ? {
                  label: search ? "Limpar busca" : "Limpar filtros",
                  onClick: handleClearFilters,
                }
              : undefined
          }
        />
      )}

      {!isLoading && !error && actions.length > 0 && (
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
