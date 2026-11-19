import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import CustomError from "@/models/error/CustomError.js";
import { lockActivityForModeration } from "@/repositories/enrollment/locks.js";
import type {
  ActivityModerationState,
  IModerationRepository,
} from "./IModerationRepository.js";
import type {
  CreateModerationDecisionInput,
  ListReportedActivitiesQuery,
  ReportedActivityStatus,
} from "@/schemas/moderation/moderationSchemas.js";
import {
  MODERATION_DECISION_SELECT,
  REPORTED_ACTIVITY_SELECT,
  type ModerationDecisionResponse,
  type ReportedActivityItem,
  toModerationDecisionResponse,
  toReportedActivityItem,
} from "@/types/moderation.js";

type Props = {
  prisma?: PrismaClient;
};

class ModerationRepository implements IModerationRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  private async countReportedActivities(
    db: PrismaClient | Prisma.TransactionClient,
    status: ReportedActivityStatus,
  ): Promise<number> {
    const rows =
      status === "open"
        ? await db.$queryRaw<{ total: number }[]>`
            SELECT COUNT(DISTINCT a."id")::int AS total
            FROM "Activity" a
            INNER JOIN "ActivityReport" r
              ON r."activityId" = a."id" AND r."decisionId" IS NULL
            WHERE a."deletedAt" IS NULL
          `
        : await db.$queryRaw<{ total: number }[]>`
            SELECT COUNT(DISTINCT a."id")::int AS total
            FROM "Activity" a
            INNER JOIN "ModerationDecision" d
              ON d."activityId" = a."id"
            WHERE NOT EXISTS (
              SELECT 1
              FROM "ActivityReport" r
              WHERE r."activityId" = a."id"
                AND r."decisionId" IS NULL
            )
          `;

    return rows[0]?.total ?? 0;
  }

  public async listReportedActivities({
    status,
    page,
    limit,
  }: ListReportedActivitiesQuery): Promise<{
    items: ReportedActivityItem[];
    total: number;
  }> {
    const skip = (page - 1) * limit;

    // Guard against offsets beyond safe integer range: return the empty page
    // past the last one promised by api-conventions §3 instead of a 500.
    if (!Number.isSafeInteger(skip)) {
      const total = await this.countReportedActivities(this._prisma, status);
      return { items: [], total };
    }

    return this._prisma.$transaction(async (tx) => {
      const total = await this.countReportedActivities(tx, status);
      if (total === 0 || skip >= total) {
        return { items: [], total };
      }

      // Raw SQL handles ORDER BY MAX(createdAt) DESC with deterministic id
      // tie-breaking, which Prisma's relational orderBy does not support.
      const pageRows =
        status === "open"
          ? await tx.$queryRaw<{ id: string }[]>`
              SELECT a."id"
              FROM "Activity" a
              INNER JOIN "ActivityReport" r
                ON r."activityId" = a."id" AND r."decisionId" IS NULL
              WHERE a."deletedAt" IS NULL
              GROUP BY a."id"
              ORDER BY MAX(r."createdAt") DESC, a."id" ASC
              LIMIT ${limit} OFFSET ${skip}
            `
          : await tx.$queryRaw<{ id: string }[]>`
              SELECT a."id"
              FROM "Activity" a
              INNER JOIN "ModerationDecision" d
                ON d."activityId" = a."id"
              WHERE NOT EXISTS (
                SELECT 1
                FROM "ActivityReport" r
                WHERE r."activityId" = a."id"
                  AND r."decisionId" IS NULL
              )
              GROUP BY a."id"
              ORDER BY MAX(d."createdAt") DESC, a."id" ASC
              LIMIT ${limit} OFFSET ${skip}
            `;

      if (pageRows.length === 0) {
        return { items: [], total };
      }

      const ids = pageRows.map((row) => row.id);
      const activities = await tx.activity.findMany({
        where: { id: { in: ids } },
        select: REPORTED_ACTIVITY_SELECT,
      });

      // Preserve the SQL ordering (WHERE id IN (...) does not guarantee order).
      const byId = new Map(
        activities.map((activity) => [activity.id, activity]),
      );
      const items = ids
        .map((id) => byId.get(id))
        .filter((activity): activity is NonNullable<typeof activity> =>
          Boolean(activity),
        )
        .map(toReportedActivityItem);

      return { items, total };
    });
  }

  public async findActivityForModeration(
    activityId: string,
  ): Promise<ActivityModerationState | null> {
    const activity = await this._prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        status: true,
        removedByModerationAt: true,
        _count: {
          select: {
            activityReports: { where: { decisionId: null } },
          },
        },
      },
    });

    if (!activity) return null;

    return {
      id: activity.id,
      authorId: activity.authorId,
      status: activity.status,
      removedByModerationAt: activity.removedByModerationAt,
      openReportsCount: activity._count.activityReports,
    };
  }

  public async createDecision(
    activityId: string,
    managerId: string,
    data: CreateModerationDecisionInput,
  ): Promise<ModerationDecisionResponse> {
    return this._prisma.$transaction(async (tx) => {
      // Lock Activity first (LOCK ORDERING RULE in locks.ts) and re-check all
      // business rules under the lock so concurrent decisions, enrollments,
      // and status transitions serialize cleanly.
      const activity = await lockActivityForModeration(tx, activityId);
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

      const openReportsCount = await tx.activityReport.count({
        where: { activityId, decisionId: null },
      });
      if (openReportsCount === 0) {
        throw new CustomError(409, "Activity has no open reports.", {
          code: "NO_OPEN_REPORTS",
        });
      }

      if (data.verdict === "UPHELD" && activity.status === "COMPLETED") {
        throw new CustomError(
          409,
          "Completed activities cannot be removed by moderation.",
          { code: "ACTIVITY_COMPLETED" },
        );
      }

      const decidedAt = new Date();
      const created = await tx.moderationDecision.create({
        data: {
          activityId,
          verdict: data.verdict,
          justification: data.justification,
          decidedById: managerId,
          createdAt: decidedAt,
        },
        select: { id: true },
      });

      await tx.activityReport.updateMany({
        where: { activityId, decisionId: null },
        data: { decisionId: created.id },
      });

      if (data.verdict === "UPHELD") {
        // Preserve the original removal timestamp if the activity was already
        // marked as removed before write-blocking lands in the follow-up issue.
        if (activity.removedByModerationAt === null) {
          await tx.activity.update({
            where: { id: activityId },
            data: { removedByModerationAt: decidedAt },
          });
        }

        // Cancel active/pending enrollments except those backed by a
        // certificate, which must remain valid and downloadable.
        await tx.enrollment.updateMany({
          where: {
            activityId,
            status: { in: ["PENDING", "APPROVED"] },
            certificate: { is: null },
          },
          data: { status: "CANCELLED" },
        });
      }

      const decision = await tx.moderationDecision.findUniqueOrThrow({
        where: { id: created.id },
        select: MODERATION_DECISION_SELECT,
      });

      return toModerationDecisionResponse(decision);
    });
  }
}

export default ModerationRepository;
