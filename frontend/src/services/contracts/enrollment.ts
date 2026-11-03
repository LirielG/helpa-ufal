/**
 * Wire types for `GET /activities/:activityId/enrollments` and
 * `PUT /enrollments/:enrollmentId/attendance`.
 *
 * Written from the Bruno examples (`backend/docs/bruno/Enrollments/*`), not from
 * the backend code (§8).
 */

export type EnrollmentStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** The canonical enrollment, returned as is by `PUT /enrollments/:enrollmentId/attendance`. */
export interface Enrollment {
  id: string;
  activityId: string;
  userId: string;
  status: EnrollmentStatus;
  /**
   * Tri-state: null = not homologated yet (structural, not an error),
   * true = presence confirmed, false = absence registered. Never render null
   * as "absent".
   */
  attendanceConfirmed: boolean | null;
  /** 0 both when not homologated and when absent: read attendanceConfirmed first. */
  confirmedWorkloadHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentUser {
  id: string;
  fullName: string;
  email: string;
  /** null for teachers, who have no student registration code. */
  registrationCode: string | null;
}

/** Item of `GET /activities/:activityId/enrollments`. */
export interface EnrollmentListItem extends Enrollment {
  user: EnrollmentUser;
}

/**
 * Response of `GET /activities/:activityId/enrollments`.
 *
 * Deviates from §3: there is no `totalPages` yet. `totalPresent` counts the
 * enrollments with attendanceConfirmed = true across every page.
 */
export interface ListEnrollmentsResponse {
  items: EnrollmentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPresent: number;
}

/**
 * Body of `PUT /enrollments/:enrollmentId/attendance`. Presence and hours are
 * one pair: hours are required with a presence and forbidden with an absence.
 */
export type ConfirmAttendanceRequest =
  { attended: true; workloadHours: number } | { attended: false };
