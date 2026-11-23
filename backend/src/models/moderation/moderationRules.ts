import type { ActivityStatus, ModerationVerdict } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";

export type ModeratableActivity = {
  authorId: string;
  status: ActivityStatus;
  openReportIds: readonly string[];
};

function matchesOpenReports(
  openReportIds: readonly string[],
  requestedReportIds: readonly string[],
): boolean {
  const requested = new Set(requestedReportIds);
  if (requested.size !== openReportIds.length) {
    return false;
  }
  return openReportIds.every((id) => requested.has(id));
}

/**
 * Single source of truth for moderation decision business rules. Called as a
 * fast-path in ModerationService and re-run under SELECT ... FOR UPDATE in
 * ModerationRepository so both paths never drift apart.
 */
export function assertCanModerateActivity<T extends ModeratableActivity>(
  activity: T | null,
  managerId: string,
  verdict: ModerationVerdict,
  reportIds: readonly string[],
): asserts activity is T {
  if (!activity) {
    throw new CustomError(404, "Activity not found.", {
      code: "ACTIVITY_NOT_FOUND",
    });
  }

  if (activity.authorId === managerId) {
    throw new CustomError(
      403,
      "Activity authors cannot moderate their own activity.",
    );
  }

  if (activity.openReportIds.length === 0) {
    throw new CustomError(409, "Activity has no open reports.", {
      code: "NO_OPEN_REPORTS",
    });
  }

  if (!matchesOpenReports(activity.openReportIds, reportIds)) {
    throw new CustomError(
      409,
      "Open reports changed since the queue was loaded.",
      { code: "REPORTS_CHANGED" },
    );
  }

  if (verdict === "UPHELD" && activity.status === "COMPLETED") {
    throw new CustomError(
      409,
      "Completed activities cannot be removed by moderation.",
      { code: "ACTIVITY_COMPLETED" },
    );
  }
}
