import { api } from "@/services/api";
import type {
  ConfirmAttendanceRequest,
  Enrollment,
  ListEnrollmentsResponse,
} from "@/services/contracts/enrollment";

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
): Promise<ListEnrollmentsResponse> {
  return api.get<ListEnrollmentsResponse>(
    `/activities/${activityId}/enrollments`,
    { params: { page, limit } },
  );
}

/** Records or overwrites the attendance of an enrollment. Throws ApiError on failure. */
export async function confirmAttendance(
  enrollmentId: string,
  body: ConfirmAttendanceRequest,
): Promise<Enrollment> {
  return api.put<Enrollment>(`/enrollments/${enrollmentId}/attendance`, body);
}
