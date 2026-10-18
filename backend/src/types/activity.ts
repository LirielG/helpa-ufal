import { ActivityDetails } from "@prisma/client";
import type { EnrollmentResponse, EnrollmentStatus } from "./enrollment.js";

export type ActivityType =
  "EXTENSION" | "COURSE" | "EVENT" | "LECTURE" | "OTHER";

export type CampusLocation =
  | "MACEIO"
  | "ARAPIRACA"
  | "PALMEIRA"
  | "PENEDO"
  | "RIO_LARGO"
  | "DELMIRO_GOUVEIA"
  | "SANTANA_IPANEMA";

export type ActivityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type ActivityFormat = "IN_PERSON" | "ONLINE" | "HYBRID";

export type ActivityResponse = {
  id: string;
  authorId: string;
  title: string;
  type: ActivityType;
  campus: CampusLocation;
  startDate: Date;
  endDate: Date;
  slots: number;
  availableSlots: number;
  status: ActivityStatus;
};

export type AddressResponse = {
  id: string;
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
};

export type ActivityDetailsResponse = {
  description: string;
  area: string;
  format: ActivityFormat;
  url: string | null;
  workloadHours: number;
  address: AddressResponse | null;
};

export type ActivityFullResponse = ActivityResponse & {
  details: ActivityDetailsResponse | null;
  enrollmentStatus?: EnrollmentStatus | null;
};

export type UserActivityFilter = "enrolled" | "completed" | "managed";

/**
 * An item of GET /users/me/activities: the activity exactly as
 * GET /activities/:activityId returns it to an anonymous caller, plus the
 * token owner's enrollment. `enrollment` carries the status, so the
 * `enrollmentStatus` shortcut of the detail route is left out.
 */
export type UserActivityResponse = Omit<
  ActivityFullResponse,
  "enrollmentStatus"
> & {
  enrollment: EnrollmentResponse | null;
};

export type ActivityFilterOptions = {
  areas: string[];
};
