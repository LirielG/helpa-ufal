import { useCallback, useEffect, useRef, useState } from "react";
import type { ListReportsResponse } from "@/services/contracts/report";
import { fetchReports, REPORTS_PAGE_LIMIT } from "./services";
import { resolveReportsListError, type ReportsListError } from "./errors";

export type ModerationTab = "open" | "resolved";

/**
 * Manages the paginated moderation queue across the "open" (`resolved=false`)
 * and "resolved" (`resolved=true`) tabs.
 *
 * Every tab switch triggers a fresh request instead of filtering in memory.
 */
export function useModerationReports() {
  const [tab, setTab] = useState<ModerationTab>("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListReportsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReportsListError | null>(null);

  // Overlapping tab/page switches can settle out of order; only the latest
  // request may update the screen.
  const latestRequest = useRef(0);
  // Whether the latest request is still in flight. A removal that happens
  // meanwhile must trigger a new fetch, otherwise the pending response could
  // bring the removed report back or a needed backfill could be lost.
  const isFetching = useRef(false);

  const runLoad = useCallback(
    async (
      targetTab: ModerationTab,
      targetPage: number,
      options: { clearCurrentData?: boolean; silent?: boolean } = {},
    ) => {
      const { clearCurrentData = false, silent = false } = options;

      latestRequest.current += 1;
      const requestId = latestRequest.current;
      const isCurrent = () => requestId === latestRequest.current;

      isFetching.current = true;
      setTab(targetTab);
      setPage(targetPage);
      if (clearCurrentData) setData(null);
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      const load = (pageToLoad: number) =>
        fetchReports({
          resolved: targetTab === "resolved",
          page: pageToLoad,
          limit: REPORTS_PAGE_LIMIT,
        });

      try {
        let response = await load(targetPage);
        if (!isCurrent()) return;

        // The queue may have shrunk (e.g. another manager resolved reports)
        // so that the requested page no longer exists; fall back to the last
        // page that still holds items.
        if (
          response.items.length === 0 &&
          response.total > 0 &&
          targetPage > response.totalPages
        ) {
          setPage(response.totalPages);
          response = await load(response.totalPages);
          if (!isCurrent()) return;
        }

        setError(null);
        setData(response);
      } catch (err) {
        if (!isCurrent()) return;

        setError(resolveReportsListError(err));
      } finally {
        if (isCurrent()) {
          isFetching.current = false;
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    async function initialLoad() {
      await runLoad("open", 1);
    }

    void initialLoad();

    return () => {
      latestRequest.current += 1;
    };
  }, [runLoad]);

  const selectTab = useCallback(
    (nextTab: ModerationTab) => {
      if (nextTab === tab) return;
      void runLoad(nextTab, 1, { clearCurrentData: true });
    },
    [tab, runLoad],
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      void runLoad(tab, targetPage);
    },
    [tab, runLoad],
  );

  const retry = useCallback(() => {
    void runLoad(tab, page);
  }, [tab, page, runLoad]);

  /**
   * Drops a report from the open tab right away, without a loading state.
   *
   * Removing an item shifts the server-side offset: the first report of the
   * next page moves into the current one, even though it was never loaded.
   * So, whenever later pages exist (or a fetch is still in flight), the
   * current page is refetched silently to backfill it and to sync
   * `total`/`totalPages` with the server. On the last page the local removal
   * is already accurate and no request is made, unless the page becomes
   * empty, in which case the previous page is loaded.
   */
  const removeOpenReport = useCallback(
    (reportId: string) => {
      if (!data || !data.items.some((item) => item.id === reportId)) return;

      const nextItems = data.items.filter((item) => item.id !== reportId);
      const nextTotal = Math.max(0, data.total - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / data.limit));
      const hasLaterPages = page < data.totalPages;

      if (nextItems.length === 0 && page > 1 && nextTotal > 0) {
        void runLoad(tab, page - 1);
        return;
      }

      setData({
        ...data,
        items: nextItems,
        total: nextTotal,
        totalPages: nextTotalPages,
      });

      if (hasLaterPages || isFetching.current) {
        void runLoad(tab, page, { silent: true });
      }
    },
    [data, page, tab, runLoad],
  );

  const totalPages = data?.totalPages ?? 0;

  return {
    tab,
    page,
    totalPages,
    data,
    isLoading,
    error,
    selectTab,
    goToPage,
    retry,
    removeOpenReport,
  };
}
