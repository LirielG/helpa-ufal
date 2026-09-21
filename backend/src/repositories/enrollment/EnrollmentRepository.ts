// src/repositories/enrollment/EnrollmentRepository.ts
import { Prisma, type Enrollment, type PrismaClient } from "@prisma/client";
import type {
  EnrollmentWithActivity,
  EnrollmentWithParticipant,
  IEnrollmentRepository,
} from "@/repositories/enrollment/IEnrollmentRepository.js";
import {
  lockActivityForAttendance,
  lockActivityForCapacity,
} from "@/repositories/enrollment/locks.js";
import {
  ACTIVE_ENROLLMENT_STATUS,
  ENROLLMENT_INITIAL_STATUS,
} from "@/types/enrollment.js";
import { prisma } from "@/database/prisma.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  prisma?: PrismaClient;
};

class EnrollmentRepository implements IEnrollmentRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async findByActivityId(
    activityId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    items: EnrollmentWithParticipant[];
    total: number;
    totalPresent: number;
  }> {
    // Only active enrollments occupy slots and appear in the list — CANCELLED
    // rows stay hidden from items, total and totalPresent alike.
    const where = { activityId, status: ACTIVE_ENROLLMENT_STATUS };

    const [items, total, totalPresent] = await this._prisma.$transaction([
      this._prisma.enrollment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ enrolledAt: "asc" }, { id: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              student: { select: { registrationCode: true } },
            },
          },
        },
      }),
      this._prisma.enrollment.count({ where }),
      this._prisma.enrollment.count({
        where: { ...where, attendanceConfirmed: true },
      }),
    ]);

    return { items, total, totalPresent };
  }

  public async findByIdAndActivity(
    enrollmentId: string,
    activityId: string,
  ): Promise<Enrollment | null> {
    // findFirst, not findUnique by id: an enrollment of ANOTHER activity must
    // be indistinguishable from one that does not exist at all.
    return this._prisma.enrollment.findFirst({
      where: { id: enrollmentId, activityId },
    });
  }

  public async findByUserAndActivity(
    userId: string,
    activityId: string,
  ): Promise<Enrollment | null> {
    return this._prisma.enrollment.findUnique({
      where: { userId_activityId: { userId, activityId } },
    });
  }

  public async enroll(userId: string, activityId: string): Promise<Enrollment> {
    return this._prisma.$transaction(async (tx) => {
      // Lock BEFORE any read, and `slots` read UNDER the lock.
      const activity = await lockActivityForCapacity(tx, activityId);
      if (!activity) {
        throw new CustomError(404, "Activity not found.");
      }

      // Re-check under the lock: the value read here is the only one
      // guaranteed to be current, so the "is the activity open" decision
      // gets serialized against concurrent writers. The Service's check
      // remains as a fast-path (fails fast without opening a transaction),
      // this one is the actual source of truth for the error ordering.
      if (activity.status !== "OPEN") {
        throw new CustomError(409, "Activity is not open for enrollment.");
      }

      const existing = await tx.enrollment.findUnique({
        where: { userId_activityId: { userId, activityId } },
      });

      if (existing && existing.status !== "CANCELLED") {
        throw new CustomError(
          409,
          "User is already enrolled in this activity.",
        );
      }

      const approvedCount = await tx.enrollment.count({
        where: { activityId, status: "APPROVED" },
      });

      if (approvedCount >= activity.slots) {
        throw new CustomError(409, "No available slots for this activity.");
      }

      if (existing) {
        return tx.enrollment.update({
          where: { id: existing.id },
          data: {
            status: ENROLLMENT_INITIAL_STATUS,
            // Contract decision: reactivating a cancelled enrollment DOES
            // refresh enrolledAt to now, so the record reappears at the top
            // of the "Ações Inscritas" tab (sorted by enrolledAt desc).
            // createdAt is left untouched by Prisma/Postgres and keeps the
            // original creation date of the record.
            enrolledAt: new Date(),
            attendanceConfirmed: null,
            confirmedWorkloadHours: 0,
          },
        });
      }

      try {
        return await tx.enrollment.create({
          data: {
            userId,
            activityId,
            status: ENROLLMENT_INITIAL_STATUS,
          },
        });
      } catch (error) {
        // Defense-in-depth against execution outside of the lock
        // (e.g., another transaction that did not go through lockActivityForCapacity).
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new CustomError(
            409,
            "User is already enrolled in this activity.",
          );
        }
        throw error;
      }
    });
  }

  public async cancel(userId: string, activityId: string): Promise<void> {
    // Atomic transition: two concurrent cancellations result in one success
    // and one 404, with no race window.
    // Accepts APPROVED and PENDING
    const result = await this._prisma.enrollment.updateMany({
      where: { userId, activityId, status: { in: ["APPROVED", "PENDING"] } },
      data: { status: "CANCELLED" },
    });

    if (result.count === 0) {
      throw new CustomError(404, "Enrollment not found.");
    }
  }

  public async confirmAttendance(
    activityId: string,
    enrollmentId: string,
    attendanceConfirmed: boolean,
    confirmedWorkloadHours: number,
  ): Promise<Enrollment> {
    return this._prisma.$transaction(async (tx) => {
      // Lock BEFORE any read: status and workload ceiling are re-read under
      // the lock, so a concurrent status transition or a workload edit cannot
      // slip between the Service's checks and this write. The Service's own
      // checks stay as a fast path; these are the authoritative ones.
      const activity = await lockActivityForAttendance(tx, activityId);
      if (!activity) {
        throw new CustomError(404, "Activity not found.");
      }

      if (activity.status !== "COMPLETED") {
        throw new CustomError(
          409,
          "Attendance can only be confirmed for completed activities.",
        );
      }

      if (
        attendanceConfirmed &&
        confirmedWorkloadHours > activity.workloadHours
      ) {
        throw new CustomError(
          422,
          "workloadHours must be an integer between 1 and the activity's workload hours.",
        );
      }

      // The pair travels in a single statement — there is no path that
      // writes one column without the other. The where clause carries the
      // guards, so an enrollment that stopped being APPROVED (or never
      // belonged to this activity) is simply not written.
      const result = await tx.enrollment.updateMany({
        where: {
          id: enrollmentId,
          activityId,
          status: ACTIVE_ENROLLMENT_STATUS,
        },
        data: { attendanceConfirmed, confirmedWorkloadHours },
      });

      if (result.count === 0) {
        throw new CustomError(
          409,
          "Only approved enrollments can have attendance confirmed.",
        );
      }

      return tx.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    });
  }

  public async countApprovedByActivityId(activityId: string): Promise<number> {
    return this._prisma.enrollment.count({
      where: { activityId, status: "APPROVED" },
    });
  }

  public async findActiveByUserId(
    userId: string,
    skip = 0,
    take = 10,
  ): Promise<{ items: EnrollmentWithActivity[]; total: number }> {
    const where = { userId, status: "APPROVED" as const };

    const [items, total] = await this._prisma.$transaction([
      this._prisma.enrollment.findMany({
        where,
        skip,
        take,
        orderBy: { enrolledAt: "desc" },
        include: { activity: { include: { details: true } } },
      }),
      this._prisma.enrollment.count({ where }),
    ]);

    return { items, total };
  }
}

export default EnrollmentRepository;
