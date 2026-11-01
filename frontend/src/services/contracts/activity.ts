/**
 * Wire types for `GET /activities` and `GET /activities/:activityId`.
 *
 * Written from the Bruno examples (`backend/docs/bruno/Activities/*`), not from
 * the backend code (§8). Field names are the API's; dates are ISO 8601 strings;
 * enums are the Prisma unions. Optional-by-absence becomes `T | null` (§6).
 */

import type { EnrollmentStatus } from "./enrollment";

export type ActivityType =
  "EXTENSION" | "COURSE" | "EVENT" | "LECTURE" | "OTHER";

export type ActivityFormat = "IN_PERSON" | "ONLINE" | "HYBRID";

export type ActivityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type CampusLocation =
  | "MACEIO"
  | "ARAPIRACA"
  | "PALMEIRA"
  | "PENEDO"
  | "RIO_LARGO"
  | "DELMIRO_GOUVEIA"
  | "SANTANA_IPANEMA";

export interface ActivityAddress {
  id: string;
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
}

/** Top-level fields shared by the detail and the list item. */
interface ActivityHeader {
  id: string;
  authorId: string;
  title: string;
  type: ActivityType;
  campus: CampusLocation;
  startDate: string;
  endDate: string;
  slots: number;
  availableSlots: number;
  status: ActivityStatus;
}

/** `details` of the detail (`GET /activities/:activityId`). */
export interface ActivityDetails {
  description: string;
  area: string;
  format: ActivityFormat;
  url: string | null;
  workloadHours: number;
  address: ActivityAddress | null;
}

/** `GET /activities/:activityId` — the canonical representation. */
export interface Activity extends ActivityHeader {
  details: ActivityDetails | null;
  /**
   * The signed-in user's enrollment in this activity: absent when the request
   * carries no recognized session, null when the user never enrolled.
   */
  enrollmentStatus?: EnrollmentStatus | null;
}

/**
 * `details` of the list item (`GET /activities`): no `address`, and the raw
 * row's ids/timestamps instead.
 */
export interface ActivityListItemDetails {
  activityId: string;
  description: string;
  area: string;
  format: ActivityFormat;
  url: string | null;
  workloadHours: number;
  addressId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Item of `GET /activities`. */
export interface ActivityListItem extends ActivityHeader {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  details: ActivityListItemDetails | null;
}

/**
 * Response of `GET /activities`.
 *
 * Deviates from §3 (the envelope should be `Paginated<ActivityListItem>` keyed
 * by `items`), but this is what the route and the Bruno examples return today.
 * Migrate to `Paginated<ActivityListItem>` once the backend aligns. Never `meta`.
 */
export interface ListActivitiesResponse {
  activities: ActivityListItem[];
  total: number;
}
