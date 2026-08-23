// src/repositories/enrollment/locks.ts
import type { Prisma } from "@prisma/client";

/**
* Serializes concurrent operations on an Activity's capacity
* via pessimistic locking (SELECT ... FOR UPDATE) on the activity row. 
*
* LOCK ORDERING RULE: Activity is ALWAYS the first table locked in
* any transaction that also touches Enrollment.
* locks.ts functions as a queue per activity.
 */
export async function lockActivityForCapacity(
  tx: Prisma.TransactionClient,
  activityId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE id = ${activityId} FOR UPDATE`;
}