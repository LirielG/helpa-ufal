// src/repositories/enrollment/locks.ts
import type { Prisma } from "@prisma/client";

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
): Promise<{ slots: number } | null> {
  const rows = await tx.$queryRaw<{ slots: number }[]>`
    SELECT slots
    FROM "Activity"
    WHERE id = ${activityId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}