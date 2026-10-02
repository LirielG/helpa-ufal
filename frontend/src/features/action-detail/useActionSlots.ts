import { useState, useEffect } from "react";
import { getActionById } from "./services";

/**
 * Lightweight hook that fetches only the slot counts (slots / availableSlots)
 * for an activity. Used by EnrollmentsPage to display the vacancy fill rate
 * alongside the enrollment list without blocking it.
 *
 * Failures are silent — the page stays functional with a safe fallback.
 */
export function useActionSlots(activityId: string) {
  const [slots, setSlots] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);

  useEffect(() => {
    if (!activityId) return;

    getActionById(activityId)
      .then((action) => {
        if (action) {
          setSlots(action.slots);
          setAvailableSlots(action.availableSlots);
        }
      })
      .catch(() => {
        // Non-critical: enrollment list is still shown without slot counts.
      });
  }, [activityId]);

  return { slots, availableSlots };
}
