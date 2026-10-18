/**
 * Wire types for `GET /users/me/activities`.
 *
 * Written from the Bruno examples (`backend/docs/bruno/User/*`), not from the
 * backend code (§8).
 */

import type { Activity } from "./activity";
import type { Enrollment } from "./enrollment";

export type UserActivityFilter = "enrolled" | "completed" | "managed";

/** `validationCode` comes in its stored form; hyphenating it is the screen's job. */
export interface UserActivityCertificate {
  id: string;
  validationCode: string;
  issuedAt: string;
}

/**
 * Item of `GET /users/me/activities`: the activity as `GET /activities/:activityId`
 * returns it, plus the signed-in user's enrollment and its certificate.
 * `enrollment` carries the status, so `enrollmentStatus` never comes.
 */
export interface UserActivityItem extends Omit<Activity, "enrollmentStatus"> {
  /** null in "managed" when the author is not enrolled in their own action. */
  enrollment: Enrollment | null;
  /** null until the presence is homologated. */
  certificate: UserActivityCertificate | null;
}
