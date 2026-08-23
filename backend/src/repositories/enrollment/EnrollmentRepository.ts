// src/repositories/enrollment/EnrollmentRepository.ts
import { Prisma, type Enrollment, type PrismaClient } from "@prisma/client";
import type {
  EnrollmentWithActivity,
  IEnrollmentRepository,
} from "@/repositories/enrollment/IEnrollmentRepository.js";
import { lockActivityForCapacity } from "@/repositories/enrollment/locks.js";
import { ENROLLMENT_INITIAL_STATUS } from "@/types/enrollment.js";
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

  public async findByUserAndActivity(
    userId: string,
    activityId: string,
  ): Promise<Enrollment | null> {
    return this._prisma.enrollment.findUnique({
      where: { userId_activityId: { userId, activityId } },
    });
  }

  public async enroll(
    userId: string,
    activityId: string,
    slots: number,
  ): Promise<Enrollment> {
    return this._prisma.$transaction(
      async (tx) => {
        // Lock BEFORE any read: serializes concurrent registrations
        // in this activity and makes the count below reliable.
        await lockActivityForCapacity(tx, activityId);

        const existing = await tx.enrollment.findUnique({
          where: { userId_activityId: { userId, activityId } },
        });

        if (existing && existing.status !== "CANCELLED") {
          throw new CustomError(409, "User is already enrolled in this activity.");
        }

        const approvedCount = await tx.enrollment.count({
          where: { activityId, status: "APPROVED" },
        });

        if (approvedCount >= slots) {
          throw new CustomError(409, "No available slots for this activity.");
        }

        if (existing) {
          return tx.enrollment.update({
            where: { id: existing.id },
            data: {
              status: ENROLLMENT_INITIAL_STATUS,
              enrolledAt: new Date(),
              attendanceConfirmed: false,
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
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            throw new CustomError(409, "User is already enrolled in this activity.");
          }

          throw error;
        }
      },
    );
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