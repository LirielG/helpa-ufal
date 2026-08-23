import type { Enrollment, Prisma } from "@prisma/client";

export type EnrollmentWithActivity = Prisma.EnrollmentGetPayload<{
  include: { activity: { include: { details: true } } };
}>;

export interface IEnrollmentRepository {
  findByUserAndActivity(userId: string, activityId: string): Promise<Enrollment | null>;

  /* Registers the user for the activity or REACTIVATES a CANCELLED registration */
  enroll(userId: string, activityId: string, slots: number): Promise<Enrollment>;

  /* Atomic transition {APPROVED, PENDING} -> CANCELLED (soft delete) */
  cancel(userId: string, activityId: string): Promise<void>;

  countApprovedByActivityId(activityId: string): Promise<number>;

  /* Foundation for the "Subscribed Actions" tab (Epic 3): lists only APPROVED items */
  findActiveByUserId(
    userId: string,
    skip?: number,
    take?: number,
  ): Promise<{ items: EnrollmentWithActivity[]; total: number }>;
}