import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import type { IActivityReportRepository } from "./IActivityReportRepository.js";
import { type ActivityReportResponse, toActivityReportResponse } from "@/types/activityReport.js";
import { CreateActivityReportInput } from "@/schemas/activityReport/activityReportSchemas.js";

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
}

export default ActivityReportRepository;