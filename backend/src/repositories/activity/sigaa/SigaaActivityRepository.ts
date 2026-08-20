import type { PrismaClient, SigaaActivity } from "@prisma/client";
import type { ISigaaActivityRepository } from "./ISigaaActivityRepository.js";
import type { IScrapedSigaaActivity, ISigaaActivityFilters } from "@/types/sigaa.js";
import { prisma } from "@/database/prisma.js";

type Props = {
  prisma?: PrismaClient;
};

export class SigaaActivityRepository implements ISigaaActivityRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async getLatestLastSeenAt(): Promise<Date | null> {
    const latest = await this._prisma.sigaaActivity.findFirst({
      select: { lastSeenAt: true },
      orderBy: { lastSeenAt: "desc" },
    });
    return latest?.lastSeenAt ?? null;
  }

  public async upsertMany(
    activities: IScrapedSigaaActivity[],
    syncTimestamp: Date
  ): Promise<void> {
    if (activities.length === 0) return;

    // Executa upserts em lotes para performance e consistência
    const batchSize = 50;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      await this._prisma.$transaction(
        batch.map((item) =>
          this._prisma.sigaaActivity.upsert({
            where: { sigaaId: item.sigaaId },
            create: {
              sigaaId: item.sigaaId,
              title: item.title,
              type: item.type,
              normalizedType: item.normalizedType,
              department: item.department,
              isActive: true,
              lastSeenAt: syncTimestamp,
            },
            update: {
              title: item.title,
              type: item.type,
              normalizedType: item.normalizedType,
              department: item.department,
              isActive: true,
              lastSeenAt: syncTimestamp,
            },
          })
        )
      );
    }
  }

  public async markInactiveBefore(syncTimestamp: Date): Promise<number> {
    const result = await this._prisma.sigaaActivity.updateMany({
      where: {
        lastSeenAt: { lt: syncTimestamp },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    return result.count;
  }

  public async list(
    filters: ISigaaActivityFilters
  ): Promise<{ activities: SigaaActivity[]; total: number }> {
    const where: any = { isActive: true };

    if (filters.type) {
      where.normalizedType = filters.type;
    }

    if (filters.search) {
      where.title = {
        contains: filters.search,
        mode: "insensitive",
      };
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const skip = (page - 1) * limit;

    const orderBy = filters.orderBy || "createdAt";
    const order = filters.order === "asc" ? "asc" : "desc";

    const [activities, total] = await Promise.all([
      this._prisma.sigaaActivity.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip,
        take: limit,
      }),
      this._prisma.sigaaActivity.count({ where }),
    ]);

    return { activities, total };
  }
}

export default SigaaActivityRepository;
