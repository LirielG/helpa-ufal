import { Alert } from "../../../components/Alert";
import { Pagination } from "../../../components/Pagination";
import type { Action, FilterOptions } from "../types";
import { ActionGrid } from "./ActionGrid";
import { FilterBar } from "./FilterBar";

interface HelpaFeedProps {
  actions: Action[];
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  error: string | null;
}

export function HelpaFeed({
  actions,
  filters,
  onFilterChange,
  page,
  totalPages,
  onPageChange,
  isLoading,
  error,
}: HelpaFeedProps) {
  return (
    <div className="flex flex-col gap-8">
      <FilterBar filters={filters} onFilterChange={onFilterChange} />

      {isLoading && (
        <p className="text-center text-gray-500 py-10 font-medium">
          Buscando ações...
        </p>
      )}

      {!isLoading && error && <Alert type="error" message={error} />}

      {!isLoading && !error && actions.length === 0 && (
        <p className="text-center text-gray-500 py-10 font-medium">
          Nenhuma ação encontrada com esses filtros.
        </p>
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
