// src/repositories/enrollment/locks.ts
import type { ActivityStatus, Prisma } from "@prisma/client";

/**
 * Locks the Activity row (SELECT ... FOR UPDATE) and returns the fields
 * read while under the lock. It is this post-lock read that >ensures< the
 * capacity decision uses the most recent `slots` value: concurrent
 * writers for the row (e.g., a slots PATCH) block until this transaction commits.
 *
 * LOCK ORDERING RULE: Activity is ALWAYS the first table locked in
 * any transaction that also touches Inscrição.
 * locks.ts functions as a queue per activity.
 */
export async function lockActivityForCapacity(
  tx: Prisma.TransactionClient,
  activityId: string,
): Promise<{ slots: number; status: ActivityStatus } | null> {
  const rows = await tx.$queryRaw<{ slots: number; status: ActivityStatus }[]>`
    SELECT slots, status
    FROM "Activity"
    WHERE id = ${activityId}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
/**
 * Locks the Activity row and returns, read under that lock, the two values the
 * attendance decision depends on: the activity status and the workload ceiling
 * (which lives in activity_details). `FOR UPDATE OF a` locks the Activity row
 * only — activity_details is read, never locked — so this keeps the lock
 * ordering rule above: Activity first, always.
 *
 * Returns null for an activity that does not exist or was soft-deleted.
 */
export async function lockActivityForAttendance(
  tx: Prisma.TransactionClient,
  activityId: string,
): Promise<{ status: ActivityStatus; workloadHours: number } | null> {
  const rows = await tx.$queryRaw<
    { status: ActivityStatus; workloadHours: number }[]
  >`
    SELECT a.status, d."workloadHours"
    FROM "Activity" a
    JOIN "activity_details" d ON d."activityId" = a.id
    WHERE a.id = ${activityId}
      AND a."deletedAt" IS NULL
    FOR UPDATE OF a
  `;
  return rows[0] ?? null;
}
