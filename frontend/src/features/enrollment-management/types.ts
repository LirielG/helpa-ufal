/**
 * Tri-state attendance flag:
 * - null  = not recorded yet (structural state, not an error)
 * - true  = presence confirmed
 * - false = absence recorded
 *
 * Never render null as "absent".
 */
export type AttendanceStatus = null | true | false;

export type EnrollmentStatus = "ENROLLED" | "CANCELLED";

export interface Enrollment {
  enrollmentId: string;
  userId: string;
  fullName: string;
  email: string;
  /** Nullable — teachers have no registration code. Render as empty, never "null". */
  registrationCode: string | null;
  status: EnrollmentStatus;
  /** See AttendanceStatus above. */
  attendanceConfirmed: AttendanceStatus;
  /** Ambiguous on its own — always use attendanceConfirmed to interpret. */
  confirmedWorkloadHours: number;
}

/** Response envelope from GET /activities/:activityId/enrollments. */
export interface EnrollmentsResponse {
  items: Enrollment[];
  total: number;
  page: number;
  limit: number;
  totalPresent: number;
}
