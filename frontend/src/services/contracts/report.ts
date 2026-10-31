/**
 * Wire types for `GET /reports` and `PUT /reports/:reportId/resolution`.
 *
 * Written from the Bruno examples (`backend/docs/bruno/Reports/*`), not from
 * the backend code (§8).
 */

import type { Paginated } from "./common";

export type ReportReason =
  "SPAM" | "INAPPROPRIATE_CONTENT" | "MISINFORMATION" | "DUPLICATE" | "OTHER";

export interface ReportActivity {
  id: string;
  title: string;
  authorId: string;
}

export interface ReportReporter {
  id: string;
  fullName: string;
}

/**
 * A report as exposed by `GET /reports` and returned by
 * `PUT /reports/:reportId/resolution`.
 */
export interface Report {
  id: string;
  category: ReportReason;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** Soft-deleted activities are still listed: removing an activity from the feed does not close its reports. */
  activity: ReportActivity;
  /** null when the reporter's account was removed. */
  reporter: ReportReporter | null;
}

export type ListReportsResponse = Paginated<Report>;
