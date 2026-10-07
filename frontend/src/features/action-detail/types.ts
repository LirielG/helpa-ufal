import type {
  Action,
  ActionDetails as ActionListDetails,
} from "../dashboard/types";

export interface ActionAddress {
  id: string;
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
}

export interface ActionDetails extends ActionListDetails {
  address: ActionAddress | null;
}

export interface ActionDetail extends Action {
  details: ActionDetails | null;
}

/**
 * Tri-state attendance flag returned by #145:
 * - null  = not recorded yet (structural state, not an error)
 * - true  = presence confirmed
 * - false = absence recorded
 *
 * Never render null as "absent" — see migration note in #150.
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

/** Response envelope from GET /activities/:activityId/enrollments (#145). */
export interface EnrollmentsResponse {
  items: Enrollment[];
  total: number;
  page: number;
  limit: number;
  totalPresent: number;
}
