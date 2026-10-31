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

  const runLoad = useCallback(
    async (
      targetTab: ModerationTab,
      targetPage: number,
      clearCurrentData = false,
    ) => {
      latestRequest.current += 1;
      const requestId = latestRequest.current;
      const isCurrent = () => requestId === latestRequest.current;

      setTab(targetTab);
      setPage(targetPage);
      if (clearCurrentData) setData(null);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchReports({
          resolved: targetTab === "resolved",
          page: targetPage,
          limit: REPORTS_PAGE_LIMIT,
        });
        if (!isCurrent()) return;

        setData(response);
      } catch (err) {
        if (!isCurrent()) return;

        setError(resolveReportsListError(err));
      } finally {
        if (isCurrent()) setIsLoading(false);
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
      void runLoad(nextTab, 1, true);
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
   * Drops a report from the open tab locally without refetching the queue.
   * Only falls back to loading the previous page when the user just emptied a
   * non-first page while earlier pages still hold items.
   */
  const removeOpenReport = useCallback(
    (reportId: string) => {
      if (!data || !data.items.some((item) => item.id === reportId)) return;

      const nextItems = data.items.filter((item) => item.id !== reportId);
      const nextTotal = Math.max(0, data.total - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / data.limit));

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
