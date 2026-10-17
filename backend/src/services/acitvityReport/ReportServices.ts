import { prisma } from "@/database/prisma.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";
import type { IListReportsResponse, ListReportsQuery, ReportDTO } from "@/schemas/activityReport/ReportSchemas.js";

export class ReportService {
  private async validateManagerInDb(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isManager: true },
    });

    if (!user) {
      throw new CustomError(401, "User account not found or inactive.");
    }

    if (!user.isManager) {
      throw new CustomError(403, "User is not a manager.");
    }
  }

  public async list(filters: ListReportsQuery, userId: string): Promise<IListReportsResponse> {
    await this.validateManagerInDb(userId);

    const pageNum = parseInt(filters.page, 10);
    const limitNum = parseInt(filters.limit, 10);

    const paginationErrors = [];
    if (isNaN(pageNum) || pageNum < 1) {
      paginationErrors.push({ field: "page", message: "page must be a positive integer." });
    }
    if (isNaN(limitNum) || limitNum < 1) {
      paginationErrors.push({ field: "limit", message: "limit must be a positive integer." });
    } else if (limitNum > 50) {
      paginationErrors.push({ field: "limit", message: "limit can not exceed 50." });
    }

    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors);
    }

    const isResolved = filters.resolved;

    const where = {
      resolvedAt: isResolved ? { not: null } : null,
    };

    const [reports, total] = await Promise.all([
      prisma.activityReport.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              authorId: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.activityReport.count({ where }),
    ]);

    const items: ReportDTO[] = reports.map((report) => ({
      id: report.id,
      category: report.category,
      description: report.description,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      activity: {
        id: report.activity.id,
        title: report.activity.title,
        authorId: report.activity.authorId,
      },
      reporter: report.user
        ? {
            id: report.user.id,
            fullName: report.user.fullName,
          }
        : null,
    }));

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  public async resolve(reportId: string, userId: string): Promise<ReportDTO> {
    if (!reportId || !isValidUUID(reportId)) {
      throw new CustomError(404, "Report not found.");
    }

    await this.validateManagerInDb(userId);

    const report = await prisma.activityReport.findUnique({
      where: { id: reportId },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            authorId: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!report) {
      throw new CustomError(404, "Report not found.");
    }

    if (report.resolvedAt) {
      throw new CustomError(409, "Report is already resolved.");
    }

    const updated = await prisma.activityReport.update({
      where: { id: reportId },
      data: {
        resolvedAt: new Date(),
        resolvedById: userId,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            authorId: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      category: updated.category,
      description: updated.description,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
      activity: {
        id: updated.activity.id,
        title: updated.activity.title,
        authorId: updated.activity.authorId,
      },
      reporter: updated.user
        ? {
            id: updated.user.id,
            fullName: updated.user.fullName,
          }
        : null,
    };
  }
}