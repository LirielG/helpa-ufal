import { api } from "@/services/api";
import type { EnrollmentsResponse } from "./types";

const DEFAULT_LIMIT = 20;

/**
 * Fetches the paginated list of enrollments for an activity.
 *
 * Throws ApiError on failure — callers are responsible for error mapping.
 * This intentionally does NOT swallow errors (contrast with getActionById).
 */
export async function fetchEnrollments(
  activityId: string,
  page: number = 1,
  limit: number = DEFAULT_LIMIT,
): Promise<EnrollmentsResponse> {
  return api.get<EnrollmentsResponse>(
    `/activities/${activityId}/enrollments`,
    { params: { page, limit } },
  );
}
