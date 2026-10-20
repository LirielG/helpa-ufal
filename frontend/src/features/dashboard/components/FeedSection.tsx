import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { HeroBanner } from "./HeroBanner";
import { FeedTabs, type FeedKey } from "./FeedTabs";
import { HelpaFeed } from "./HelpaFeed";
import { SigaaFeed } from "../../sigaa/components/SigaaFeed";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { fetchActions } from "../services";
import type { ActivityListItem } from "@/services/contracts/activity";
import type { FilterOptions } from "../types";
import { useActionRegister } from "../../../hooks/useActionRegister";

const INITIAL_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  status: "all",
  search: "",
};

interface FeedSectionProps {
  debounceMs?: number;
}

export function FeedSection({ debounceMs = 400 }: FeedSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const feed: FeedKey = searchParams.get("feed") === "sigaa" ? "sigaa" : "helpa";

  const [actions, setActions] = useState<ActivityListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [helpaHasError, setHelpaHasError] = useState(false);
  const [sigaaHasError, setSigaaHasError] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>(INITIAL_FILTERS);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }, []);

  const { area, actionType, status } = filters;
  const search = useDebouncedValue(filters.search ?? "", debounceMs);

  const requestFilters = useMemo<FilterOptions>(
    () => ({ area, actionType, status, search }),
    [area, actionType, status, search],
  );

  const changeFeed = useCallback(
    (next: FeedKey) => {
      setSigaaHasError(false);
      setSearchParams(next === "sigaa" ? { feed: "sigaa" } : {});
    },
    [setSearchParams],
  );

  const showHelpaFeed = useCallback(() => changeFeed("helpa"), [changeFeed]);

  const latestRequest = useRef(0);

  const loadActions = useCallback(() => {
    latestRequest.current += 1;
    const requestId = latestRequest.current;
    const isCurrent = () => requestId === latestRequest.current;

    setIsLoading(true);
    setHelpaHasError(false);

    fetchActions(requestFilters, page)
      .then((res) => {
        if (!isCurrent()) return;
        setActions(res.activities);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        if (!isCurrent()) return;
        console.error(err);
        setHelpaHasError(true);
      })
      .finally(() => {
        if (isCurrent()) setIsLoading(false);
      });
  }, [requestFilters, page]);

  const { setOnSuccessCallback } = useActionRegister();

  useEffect(() => {
    setOnSuccessCallback(loadActions);
    return () => setOnSuccessCallback(undefined);
  }, [loadActions, setOnSuccessCallback]);

  useEffect(() => {
    let mounted = true;
    const fetchOnMount = async () => {
      if (mounted) await loadActions();
    };
    fetchOnMount();
    return () => {
      mounted = false;
    };
  }, [loadActions]);

  return (
    <div className="w-full flex flex-col">
      <HeroBanner actions={actions} />
      <div className="w-full min-h-[50vh] bg-white">
        <div className="max-w-10xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          <FeedTabs
            active={feed}
            onChange={changeFeed}
            sigaaHasError={sigaaHasError}
          />

          {feed === "helpa" ? (
            <HelpaFeed
              actions={actions}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading}
              hasError={helpaHasError}
              onRetry={loadActions}
            />
          ) : (
            <SigaaFeed
              onExploreHelpa={showHelpaFeed}
              onErrorChange={setSigaaHasError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
