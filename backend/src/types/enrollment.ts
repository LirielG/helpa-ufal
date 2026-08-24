import type { ActivityStatus, ActivityType, CampusLocation } from "./activity.js";

export type EnrollmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// Occupies a slot and counts as an active registration.
// Remains "APPROVED" even when an approval workflow is in place.
export const ACTIVE_ENROLLMENT_STATUS: EnrollmentStatus = "APPROVED";

// Initial status for any enrollment (creation or reactivation). In the MVP, it is
// (automatic approval). When approval by the creator is implemented, simply
// switch to "PENDING" (though the vacancy count remains based on "APPROVED").
export const ENROLLMENT_INITIAL_STATUS: EnrollmentStatus = "APPROVED";

export type EnrollmentResponse = {
  id: string;
  activityId: string;
  userId: string;
  createdAt: Date;
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