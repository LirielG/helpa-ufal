import type { Enrollment, Prisma } from "@prisma/client";

export type EnrollmentWithActivity = Prisma.EnrollmentGetPayload<{
  include: { activity: { include: { details: true } } };
}>;

// Participant payload for the creator/manager view. select (not include)
// loads ONLY these fields: passwordHash and other user internals never
// enter application memory — the type can't even express them.
export type EnrollmentWithParticipant = Prisma.EnrollmentGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        fullName: true;
        email: true;
        student: { select: { registrationCode: true } };
      };
    };
  };
}>;

export interface IEnrollmentRepository {
  findByUserAndActivity(
    userId: string,
    activityId: string,
  ): Promise<Enrollment | null>;

  /* Scoped lookup: an enrollment of another activity reads as nonexistent */
  findByIdAndActivity(
    enrollmentId: string,
    activityId: string,
  ): Promise<Enrollment | null>;

  /* Registers the user for the activity or REACTIVATES a CANCELLED registration */
  enroll(userId: string, activityId: string): Promise<Enrollment>;

  /* Atomic transition {APPROVED, PENDING} -> CANCELLED (soft delete) */
  cancel(userId: string, activityId: string): Promise<void>;

  /* Writes the attendance pair atomically, re-checking the guards under lock */
  confirmAttendance(
    activityId: string,
    enrollmentId: string,
    attendanceConfirmed: boolean,
    confirmedWorkloadHours: number,
  ): Promise<Enrollment>;

  countApprovedByActivityId(activityId: string): Promise<number>;

  /* Foundation for the "Subscribed Actions" tab (Epic 3): lists only APPROVED items */
  findActiveByUserId(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: EnrollmentWithActivity[]; total: number }>;

  /* skip/take, the same vocabulary as findActiveByUserId. The service owns the
     page -> skip conversion, so a repository call can never carry a page. */
  findByActivityId(
    activityId: string,
    skip: number,
    take: number,
  ): Promise<{
    items: EnrollmentWithParticipant[];
    total: number;
    totalPresent: number;
  }>;
}
