import type {
  ActivityStatus,
  ActivityType,
  CampusLocation,
} from "./activity.js";

export type EnrollmentStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// Occupies a slot and counts as an active registration.
// Remains "APPROVED" even when an approval workflow is in place.
export const ACTIVE_ENROLLMENT_STATUS: EnrollmentStatus = "APPROVED";

// Initial status for any enrollment (creation or reactivation). In the MVP, it is
// (automatic approval). When approval by the creator is implemented, simply
// switch to "PENDING" (though the vacancy count remains based on "APPROVED").
export const ENROLLMENT_INITIAL_STATUS: EnrollmentStatus = "APPROVED";

export type EnrollResponse = {
  id: string;
  activityId: string;
  userId: string;
  createdAt: Date;
};

export type EnrollmentResponse = {
  id: string;
  activityId: string;
  userId: string;
  status: EnrollmentStatus;
  attendanceConfirmed: boolean | null;
  confirmedWorkloadHours: number;
  createdAt: Date;
  updatedAt: Date;
};

/** The canonical enrollment, shared by every route that returns one. */
export function toEnrollmentResponse(
  enrollment: EnrollmentResponse,
): EnrollmentResponse {
  return {
    id: enrollment.id,
    activityId: enrollment.activityId,
    userId: enrollment.userId,
    status: enrollment.status,
    attendanceConfirmed: enrollment.attendanceConfirmed,
    confirmedWorkloadHours: enrollment.confirmedWorkloadHours,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

export type EnrollmentUser = {
  id: string;
  fullName: string;
  email: string;
  /** Only student.registrationCode is exposed; professors get null by minimization. */
  registrationCode: string | null;
};

export type EnrollmentParticipantResponse = EnrollmentResponse & {
  user: EnrollmentUser;
};

/** Body of the attendance homologation: the outcome only, never the target. */
export type ConfirmAttendanceInput =
  { attended: false } | { attended: true; workloadHours: number };

export type ParticipantsListResponse = {
  items: EnrollmentParticipantResponse[];
  /** Global count of APPROVED enrollments — never affected by the current page. */
  total: number;
  page: number;
  limit: number;
  /** Count of attendanceConfirmed = true across ALL enrollments of the activity. */
  totalPresent: number;
};

// ---------------------------------------------------------------------------
// Epic 3 ("Registered Actions" tab) — PROVISIONAL
// ---------------------------------------------------------------------------

export type EnrollmentActivitySummary = {
  id: string;
  title: string;
  type: ActivityType;
  campus: CampusLocation;
  startDate: Date;
  endDate: Date;
  status: ActivityStatus;
};

export type EnrollmentWithActivityResponse = {
  id: string;
  activityId: string;
  userId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  activity: EnrollmentActivitySummary;
};

export type EnrollmentListResponse = {
  items: EnrollmentWithActivityResponse[];
  total: number;
  page: number;
  limit: number;
};
