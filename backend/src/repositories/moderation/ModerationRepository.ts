import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import CustomError from "@/models/error/CustomError.js";
import { assertCanModerateActivity } from "@/models/moderation/moderationRules.js";
import { lockActivityForModeration } from "@/repositories/enrollment/locks.js";
import type {
  ActivityModerationState,
  CreatedModerationDecision,
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

    // RepeatableRead keeps count, page IDs, and hydrated relations on the same
    // MVCC snapshot so a concurrent decision never returns an "open" item with
    // empty openReports or a mismatched total.
    return this._prisma.$transaction(
      async (tx) => {
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
        activityReports: {
          where: { decisionId: null },
          select: { id: true },
        },
      },
    });

    if (!activity) return null;

    return {
      id: activity.id,
      authorId: activity.authorId,
      status: activity.status,
      removedByModerationAt: activity.removedByModerationAt,
      openReportIds: activity.activityReports.map((report) => report.id),
    };
  }

  public async createDecision(
    activityId: string,
    managerId: string,
    data: CreateModerationDecisionInput,
  ): Promise<CreatedModerationDecision> {
    return this._prisma.$transaction(async (tx) => {
      // Lock Activity first (LOCK ORDERING RULE in locks.ts) and re-check all
      // business rules under the lock so concurrent decisions, enrollments,
      // and status transitions serialize cleanly.
      const activity = await lockActivityForModeration(tx, activityId);
      const openReports =
        activity && activity.authorId !== managerId
          ? await tx.activityReport.findMany({
              where: { activityId, decisionId: null },
              select: {
                id: true,
                user: { select: { email: true } },
              },
            })
          : [];
      const openReportIds = openReports.map((report) => report.id);

      const state = activity ? { ...activity, openReportIds } : null;
      assertCanModerateActivity(state, managerId, data.verdict, data.reportIds);

      const decidedAt = new Date();
      let created: { id: string };
      try {
        created = await tx.moderationDecision.create({
          data: {
            activityId,
            verdict: data.verdict,
            justification: data.justification,
            decidedById: managerId,
            createdAt: decidedAt,
          },
          select: { id: true },
        });
      } catch (err) {
        // Activity is locked FOR UPDATE above, so the only FK that can fail on
        // insert is decidedById if the manager account was deleted in flight.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2003"
        ) {
          throw new CustomError(401, "Session is no longer valid.", {
            code: "SESSION_INVALID",
          });
        }
        throw err;
      }

      await tx.activityReport.updateMany({
        where: { id: { in: openReportIds }, activityId, decisionId: null },
        data: { decisionId: created.id },
      });

      const reporterEmails = [
        ...new Set(
          openReports
            .map((report) => report.user?.email)
            .filter((email): email is string => Boolean(email)),
        ),
      ];

      let authorEmail: string | null = null;
      let cancelledEnrolleeEmails: string[] = [];

      if (data.verdict === "UPHELD") {
        // Preserve the original removal timestamp if the activity was already
        // marked as removed before write-blocking lands in the follow-up issue.
        if (state.removedByModerationAt === null) {
          await tx.activity.update({
            where: { id: activityId },
            data: { removedByModerationAt: decidedAt },
          });
        }

        const author = await tx.user.findUnique({
          where: { id: state.authorId },
          select: { email: true },
        });
        authorEmail = author?.email ?? null;

        // Cancel active/pending enrollments except those backed by a
        // certificate, which must remain valid and downloadable.
        const cancelledEnrollments = await tx.enrollment.updateManyAndReturn({
          where: {
            activityId,
            status: { in: ["PENDING", "APPROVED"] },
            certificate: { is: null },
          },
          data: { status: "CANCELLED" },
          select: {
            user: { select: { email: true } },
          },
        });

        cancelledEnrolleeEmails = [
          ...new Set(
            cancelledEnrollments
              .map((enrollment) => enrollment.user?.email)
              .filter((email): email is string => Boolean(email)),
          ),
        ];
      }

      const decision = await tx.moderationDecision.findUniqueOrThrow({
        where: { id: created.id },
        select: MODERATION_DECISION_SELECT,
      });

      return {
        decision: toModerationDecisionResponse(decision),
        notifications: {
          activityTitle: state.title,
          authorEmail,
          reporterEmails,
          cancelledEnrolleeEmails,
        },
      };
    });
  }
}

export default ModerationRepository;
