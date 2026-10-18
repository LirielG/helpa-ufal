import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError } from "@/services/apiError";
import { fetchEnrollments } from "./services";
import { getEnrollmentsErrorMessage } from "./errors";
import type {
  Enrollment,
  ListEnrollmentsResponse,
} from "@/services/contracts/enrollment";

const PAGE_LIMIT = 20;

/**
 * Manages the paginated enrollment list for a given activity.
 *
 * Error handling:
 * - ApiError is mapped to a pt-BR message via getEnrollmentsErrorMessage.
 * - 401 maps to null: the middleware redirects and nothing is displayed.
 * - Non-ApiError exceptions (unexpected) produce a generic message.
 */
export function useEnrollments(activityId: string) {
  const [data, setData] = useState<ListEnrollmentsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clicking quickly between pages fires overlapping requests that can settle
  // out of order. Only the newest one may touch the screen, so a late response
  // can neither overwrite the current page nor erase a fresher error.
  const latestRequest = useRef(0);

  /**
   * Shared async fetch implementation.
   * Declared outside useEffect so it can also be exposed as goToPage.
   */
  const runLoad = useCallback(
    async (targetPage: number) => {
      latestRequest.current += 1;
      const requestId = latestRequest.current;
      const isCurrent = () => requestId === latestRequest.current;

      // Record the page being requested up front, not on success: if this
      // request fails, the retry button calls goToPage(page) and must ask for
      // the page that failed, not the last one that happened to load.
      setPage(targetPage);
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchEnrollments(activityId, targetPage, PAGE_LIMIT);
        if (!isCurrent()) return;

        setData(result);
      } catch (err) {
        if (!isCurrent()) return;

        const message =
          err instanceof ApiError
            ? getEnrollmentsErrorMessage(err)
            : "Erro ao carregar os inscritos. Tente novamente.";
        // null means 401 — middleware redirects, we stay silent
        setError(message);
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [activityId],
  );

  useEffect(() => {
    // Define the async function inside the effect to satisfy the
    // react-hooks/set-state-in-effect lint rule (setState is only called
    // from within the async callback, not synchronously in the effect body).
    async function initialLoad() {
      await runLoad(1);
    }

    void initialLoad();

    // Unmounting, or moving to another activity, abandons whatever is in
    // flight: bumping the counter makes its isCurrent() false.
    return () => {
      latestRequest.current += 1;
    };
  }, [runLoad]);

  /**
   * Swaps a row for the enrollment the attendance route answered with, so the
   * screen reflects the homologation without fetching the page again.
   * totalPresent only moves when the row enters or leaves the "present" state:
   * correcting the hours of someone already present keeps the count.
   */
  const applyAttendance = useCallback((updated: Enrollment) => {
    setData((current) => {
      if (!current) return current;

      const previous = current.items.find((item) => item.id === updated.id);
      if (!previous) return current;

      const wasPresent = previous.attendanceConfirmed === true;
      const isPresent = updated.attendanceConfirmed === true;

      return {
        ...current,
        items: current.items.map((item) =>
          item.id === updated.id ? { ...updated, user: item.user } : item,
        ),
        totalPresent:
          current.totalPresent + Number(isPresent) - Number(wasPresent),
      };
    });
  }, []);

  const totalPages = data ? Math.ceil(data.total / PAGE_LIMIT) : 0;

  return {
    data,
    page,
    totalPages,
    isLoading,
    error,
    goToPage: runLoad,
    applyAttendance,
  };
}
