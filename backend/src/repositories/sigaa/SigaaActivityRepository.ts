import type { PrismaClient, SigaaActivity, Prisma } from "@prisma/client";
import type {
  ISigaaActivityRepository,
  SigaaRepoFilters,
} from "./ISigaaActivityRepository.js";
import type { ScrapedSigaaActivity } from "@/types/sigaa.js";
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
    activities: ScrapedSigaaActivity[],
    syncTimestamp: Date,
  ): Promise<void> {
    if (activities.length === 0) return;

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
          }),
        ),
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
    filters: SigaaRepoFilters,
  ): Promise<{ activities: SigaaActivity[]; total: number }> {
    const where: Prisma.SigaaActivityWhereInput = { isActive: true };

    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.department) {
      where.department = filters.department;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [activities, total] = await Promise.all([
      this._prisma.sigaaActivity.findMany({
        where,
        orderBy: { [filters.orderBy]: filters.order },
        skip,
        take: filters.limit,
      }),
      this._prisma.sigaaActivity.count({ where }),
    ]);

    return { activities, total };
  }

  public async listDistinctTypes(): Promise<string[]> {
    const rows = await this._prisma.sigaaActivity.groupBy({
      by: ["type"],
      where: { isActive: true },
      orderBy: { type: "asc" },
    });
    return rows.map((r) => r.type);
  }

  public async listDistinctDepartments(): Promise<string[]> {
    const rows = await this._prisma.sigaaActivity.groupBy({
      by: ["department"],
      where: { isActive: true, department: { not: null } },
      orderBy: { department: "asc" },
    });
    return rows.map((r) => r.department!);
  }
}

export default SigaaActivityRepository;
