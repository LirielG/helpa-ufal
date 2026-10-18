import { useState, useEffect, useCallback, useRef } from "react";
import { getActionById } from "@/features/action-detail/services";
import type { Activity } from "@/services/contracts/activity";

/**
 * Fetches the activity whose enrollments EnrollmentsPage lists: its slot
 * counts feed the vacancy line, and its status and workload decide whether
 * attendance can be homologated and up to how many hours.
 *
 * Failures are silent — the list stays usable, and every control that depends
 * on the activity stays hidden until it loads. A failed reload keeps the
 * activity already shown instead of hiding those controls.
 */
export function useEnrollmentActivity(activityId: string) {
  // Keyed by id so that, when the route moves to another activity, the
  // previous one's status and workload never drive the new list.
  const [loaded, setLoaded] = useState<Activity | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    latestRequest.current += 1;
    const requestId = latestRequest.current;

    void getActionById(activityId).then((result) => {
      if (requestId !== latestRequest.current || !result) return;
      setLoaded(result);
    });
  }, [activityId]);

  useEffect(() => {
    if (!activityId) return;

    load();

    return () => {
      latestRequest.current += 1;
    };
  }, [activityId, load]);

  const activity = loaded?.id === activityId ? loaded : null;

  return { activity, reload: load };
}
