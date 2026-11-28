import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { FeedTabs, type FeedKey } from "./FeedTabs";
import { HelpaFeed } from "./HelpaFeed";
import { SigaaFeed } from "../../sigaa/components/SigaaFeed";
import { HeroBanner } from "./HeroBanner";
import bgFeed from "../../../assets/bg.svg";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { fetchActions } from "../services";
import type { ActivityListItem } from "@/services/contracts/activity";
import { DEFAULT_STATUS_FILTER, isStatusFilterValue } from "../constants";
import type { FilterOptions, StatusFilterValue } from "../types";
import { useActionRegister } from "../../../hooks/useActionRegister";

const INITIAL_LOCAL_FILTERS: Omit<FilterOptions, "status"> = {
  area: "all",
  actionType: "all",
  search: "",
};

const FEED_BACKGROUND_STYLE = {
  backgroundImage: `url(${bgFeed})`,
  backgroundPosition: "top center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
};

interface FeedSectionProps {
  /** Tests pass 0 to skip fake timers; the UI keeps the typing debounce. */
  debounceMs?: number;
}

export function FeedSection({ debounceMs = 400 }: FeedSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const feed: FeedKey =
    searchParams.get("feed") === "sigaa" ? "sigaa" : "helpa";

  const statusParam = searchParams.get("status");
  const status: StatusFilterValue = isStatusFilterValue(statusParam)
    ? statusParam
    : DEFAULT_STATUS_FILTER;

  const [actions, setActions] = useState<ActivityListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [helpaHasError, setHelpaHasError] = useState(false);
  const [sigaaHasError, setSigaaHasError] = useState(false);
  const [heroRefreshKey, setHeroRefreshKey] = useState(0);

  const [localFilters, setLocalFilters] = useState<
    Omit<FilterOptions, "status">
  >(INITIAL_LOCAL_FILTERS);

  const filters = useMemo<FilterOptions>(
    () => ({ ...localFilters, status }),
    [localFilters, status],
  );

  const handleFilterChange = useCallback(
    (key: keyof FilterOptions, value: string) => {
      if (key === "status") {
        const nextStatus = isStatusFilterValue(value)
          ? value
          : DEFAULT_STATUS_FILTER;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (nextStatus === DEFAULT_STATUS_FILTER) {
            next.delete("status");
          } else {
            next.set("status", nextStatus);
          }
          return next;
        });
      } else {
        setLocalFilters((prev) => ({ ...prev, [key]: value }));
      }
      setPage(1);
    },
    [setSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    setLocalFilters(INITIAL_LOCAL_FILTERS);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("status");
      return next;
    });
    setPage(1);
  }, [setSearchParams]);

  const { area, actionType } = localFilters;
  const search = useDebouncedValue(localFilters.search ?? "", debounceMs);

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

        setActions(res.items);
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

  const reloadAll = useCallback(() => {
    loadActions();
    setHeroRefreshKey((prev) => prev + 1);
  }, [loadActions]);

  const { setOnSuccessCallback } = useActionRegister();

  useEffect(() => {
    setOnSuccessCallback(reloadAll);

    return () => setOnSuccessCallback(undefined);
  }, [reloadAll, setOnSuccessCallback]);

  useEffect(() => {
    let mounted = true;

    const fetchOnMount = async () => {
      if (mounted) {
        await loadActions();
      }
    };

    fetchOnMount();

    return () => {
      mounted = false;
    };
  }, [loadActions]);

  return (
    <div className="w-full flex flex-col">
      <HeroBanner refreshKey={heroRefreshKey} />

      <div
        className="w-full min-h-[50vh] bg-white"
        style={FEED_BACKGROUND_STYLE}
      >
        <div className="page-container py-8 flex flex-col gap-8">
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