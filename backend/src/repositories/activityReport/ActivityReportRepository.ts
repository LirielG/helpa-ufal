import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import type { IActivityReportRepository } from "./IActivityReportRepository.js";
import {
  type ActivityReportResponse,
  type ReportResponse,
  REPORT_RESPONSE_INCLUDE,
  toActivityReportResponse,
  toReportResponse,
} from "@/types/activityReport.js";
import {
  CreateActivityReportInput,
  ListReportsQuery,
} from "@/schemas/activityReport/activityReportSchemas.js";

type Props = {
  prisma?: PrismaClient;
};

class ActivityReportRepository implements IActivityReportRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async create(
    activityId: string,
    userId: string,
    data: CreateActivityReportInput,
  ): Promise<ActivityReportResponse> {
    const report = await this._prisma.activityReport.create({
      data: {
        activityId,
        userId,
        category: data.category,
        description: data.description ?? null,
      },
    });

    return toActivityReportResponse(report);
  }

  public async findByUserAndActivity(
    userId: string,
    activityId: string,
  ): Promise<ActivityReportResponse | null> {
    const report = await this._prisma.activityReport.findUnique({
      where: { userId_activityId: { userId, activityId } },
    });

    if (!report) return null;
    return toActivityReportResponse(report);
  }

  public async list({
    resolved,
    page,
    limit,
  }: ListReportsQuery): Promise<{ items: ReportResponse[]; total: number }> {
    const where: Prisma.ActivityReportWhereInput = {
      resolvedAt: resolved ? { not: null } : null,
    };

    const [reports, total] = await Promise.all([
      this._prisma.activityReport.findMany({
        where,
        include: REPORT_RESPONSE_INCLUDE,
        // id breaks createdAt ties so pages never overlap or skip rows.
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this._prisma.activityReport.count({ where }),
    ]);

    return { items: reports.map(toReportResponse), total };
  }

  public async findById(id: string): Promise<ReportResponse | null> {
    const report = await this._prisma.activityReport.findUnique({
      where: { id },
      include: REPORT_RESPONSE_INCLUDE,
    });

    if (!report) return null;
    return toReportResponse(report);
  }

  public async resolve(
    id: string,
    resolverId: string,
  ): Promise<ReportResponse | null> {
    // Guarding on resolvedAt: null makes the write conditional in the
    // database: when two managers resolve at once only the first update
    // lands, so resolvedById keeps whoever resolved first.
    await this._prisma.activityReport.updateMany({
      where: { id, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedById: resolverId },
    });

    return this.findById(id);
  }
}

export default ActivityReportRepository;
