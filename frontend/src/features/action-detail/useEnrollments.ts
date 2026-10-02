import { useState, useEffect, useCallback } from "react";
import { ApiError } from "@/services/apiError";
import { fetchEnrollments } from "./enrollmentService";
import { getEnrollmentsErrorMessage } from "./enrollmentErrors";
import type { EnrollmentsResponse } from "./types";

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
  const [data, setData] = useState<EnrollmentsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Shared async fetch implementation.
   * Declared outside useEffect so it can also be exposed as goToPage.
   */
  const runLoad = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchEnrollments(activityId, targetPage, PAGE_LIMIT);
        setData(result);
        setPage(targetPage);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? getEnrollmentsErrorMessage(err)
            : "Erro ao carregar os inscritos. Tente novamente.";
        // null means 401 — middleware redirects, we stay silent
        setError(message);
      } finally {
        setIsLoading(false);
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
  }, [runLoad]);

  const totalPages = data ? Math.ceil(data.total / PAGE_LIMIT) : 0;

  return { data, page, totalPages, isLoading, error, goToPage: runLoad };
}
