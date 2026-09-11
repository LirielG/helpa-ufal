import { useCallback, useEffect, useState } from "react";
import { Pagination } from "../../../components/Pagination";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { ALL_OPTION, DEFAULT_SIGAA_ORDER, SIGAA_PAGE_SIZE } from "../constants";
import { fetchSigaaActivities, fetchSigaaFilterOptions } from "../services";
import type {
  SigaaActivity,
  SigaaFeedFilters,
  SigaaFilterOptions,
} from "../types";
import { SigaaActivityRow } from "./SigaaActivityRow";
import { SigaaFeedFallback } from "./SigaaFeedFallback";
import { SigaaFilterBar } from "./SigaaFilterBar";

interface SigaaFeedProps {
  onExploreHelpa: () => void;
  onErrorChange?: (hasError: boolean) => void;
  /** Tests pass 0 to skip fake timers; the UI keeps the typing debounce. */
  debounceMs?: number;
}

const INITIAL_FILTERS: SigaaFeedFilters = {
  search: "",
  type: ALL_OPTION,
  department: ALL_OPTION,
  order: DEFAULT_SIGAA_ORDER,
};

const NO_OPTIONS: SigaaFilterOptions = { types: [], departments: [] };

type LoadedPage = {
  key: string;
  items: SigaaActivity[];
  total: number;
  limit: number;
};

export function SigaaFeed({
  onExploreHelpa,
  onErrorChange,
  debounceMs = 400,
}: SigaaFeedProps) {
  const [filters, setFilters] = useState<SigaaFeedFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  const [options, setOptions] = useState<SigaaFilterOptions>(NO_OPTIONS);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const { type, department, order } = filters;
  const search = useDebouncedValue(filters.search, debounceMs);

  // Identifies the request the screen is currently showing. Loading and staleness
  // are derived from it instead of being set up front, so a response that belongs
  // to an abandoned filter can never overwrite a newer one.
  const queryKey = JSON.stringify([
    search,
    type,
    department,
    order,
    page,
    attempt,
  ]);

  const isLoading = loaded?.key !== queryKey && failedKey !== queryKey;
  const hasError = failedKey === queryKey;

  const handleFilterChange = useCallback(
    (key: keyof SigaaFeedFilters, value: string) => {
      setFilters((previous) => ({ ...previous, [key]: value }));
      setPage(1);
    },
    [],
  );

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // Failing options leave the selects disabled; the list is fetched regardless,
  // because with no filter applied the API still answers with everything.
  useEffect(() => {
    let active = true;

    fetchSigaaFilterOptions()
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch(() => {
        if (active) setOptions(NO_OPTIONS);
      })
      .finally(() => {
        if (active) setIsLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetchSigaaActivities({ search, type, department, order }, page)
      .then((result) => {
        if (!active) return;
        setLoaded({
          key: queryKey,
          items: result.items,
          total: result.total,
          limit: result.limit || SIGAA_PAGE_SIZE,
        });
        onErrorChange?.(false);
      })
      .catch(() => {
        if (!active) return;
        setFailedKey(queryKey);
        onErrorChange?.(true);
      });

    return () => {
      active = false;
    };
  }, [queryKey, search, type, department, order, page, onErrorChange]);

  const activities = loaded?.key === queryKey ? loaded.items : [];
  // The SIGAA response carries no totalPages, unlike GET /activities.
  const totalPages = loaded
    ? Math.max(1, Math.ceil(loaded.total / loaded.limit))
    : 1;

  return (
    <div className="flex flex-col gap-8">
      <SigaaFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        options={options}
        isLoadingOptions={isLoadingOptions}
        hasError={hasError}
      />

      {isLoading && (
        <p className="text-center text-gray-500 py-10 font-medium">
          Buscando ações do SIGAA...
        </p>
      )}

      {!isLoading && hasError && (
        <SigaaFeedFallback
          variant="error"
          onRetry={retry}
          onExploreHelpa={onExploreHelpa}
        />
      )}

      {!isLoading && !hasError && activities.length === 0 && (
        <SigaaFeedFallback
          variant="empty"
          onRetry={retry}
          onExploreHelpa={onExploreHelpa}
        />
      )}

      {!isLoading && !hasError && activities.length > 0 && (
        <>
          <ul className="flex flex-col gap-4">
            {activities.map((activity) => (
              <SigaaActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
