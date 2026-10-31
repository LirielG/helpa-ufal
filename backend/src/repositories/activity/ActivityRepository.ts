import type {
  PrismaClient,
  Prisma,
  Activity,
  ActivityStatus,
} from "@prisma/client";
import type {
  IActivityRepository,
  IRepositoryListActivitiesFilters,
  IRepositoryListActivitiesResponse,
} from "@/repositories/activity/IActivityRepository.js";
import type {
  CreateActivityInput,
  UpdateActivityInput,
} from "@/schemas/activity/ActivitySchemas.js";
import { prisma } from "@/database/prisma.js";
import {
  ActivityFullResponse,
  UserActivityFilter,
  UserActivityResponse,
} from "@/types/activity.js";
import {
  ACTIVE_ENROLLMENT_STATUS,
  toEnrollmentResponse,
} from "@/types/enrollment.js";

type Props = {
  prisma?: PrismaClient;
};

type ActivityWithDetails = Prisma.ActivityGetPayload<{
  include: { details: { include: { address: true } } };
}>;

function userActivityWhere(
  userId: string,
  filter: UserActivityFilter,
): Prisma.ActivityWhereInput {
  switch (filter) {
    case "enrolled":
      return {
        deletedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        enrollments: { some: { userId, status: ACTIVE_ENROLLMENT_STATUS } },
      };
    case "completed":
      return {
        status: "COMPLETED",
        OR: [
          {
            deletedAt: null,
            enrollments: {
              some: {
                userId,
                status: ACTIVE_ENROLLMENT_STATUS,
                // Only a registered absence (false) leaves the history: a
                // participant whose attendance nobody homologated yet (null)
                // still took part. `{ not: false }` would not do, since SQL
                // drops NULL from that comparison too.
                OR: [
                  { attendanceConfirmed: true },
                  { attendanceConfirmed: null },
                ],
              },
            },
          },
          // A deleted activity stays only for those it issued a certificate
          // to: the certificate remains valid and downloadable, and this list
          // is the only place the client gets its id from.
          {
            deletedAt: { not: null },
            enrollments: {
              some: {
                userId,
                status: ACTIVE_ENROLLMENT_STATUS,
                attendanceConfirmed: true,
                certificate: { isNot: null },
              },
            },
          },
        ],
      };
    case "managed":
      return { deletedAt: null, authorId: userId };
  }
}

function toFullResponse(
  activity: ActivityWithDetails,
  approvedCount: number,
): ActivityFullResponse {
  return {
    id: activity.id,
    authorId: activity.authorId,
    title: activity.title,
    type: activity.type,
    campus: activity.campus,
    startDate: activity.startDate,
    endDate: activity.endDate,
    slots: activity.slots,
    availableSlots: Math.max(0, activity.slots - approvedCount),
    status: activity.status,
    details: activity.details
      ? {
          description: activity.details.description,
          area: activity.details.area,
          format: activity.details.format,
          url: activity.details.url ?? null,
          workloadHours: activity.details.workloadHours,
          address: activity.details.address
            ? {
                id: activity.details.address.id,
                addressLine: activity.details.address.addressLine,
                district: activity.details.address.district,
                zipCode: activity.details.address.zipCode,
                city: activity.details.address.city,
                state: activity.details.address.state,
              }
            : null,
        }
      : null,
  };
}

class ActivityRepository implements IActivityRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async create(
    authorId: string,
    data: CreateActivityInput,
  ): Promise<ActivityFullResponse> {
    return this._prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          authorId,
          title: data.title,
          type: data.type,
          campus: data.campus,
          startDate: data.startDate,
          endDate: data.endDate,
          slots: data.slots,
          status: "OPEN",
        },
      });

      let addressId: string | null = null;
      let createdAddress = null;

      if (data.format !== "ONLINE" && data.address) {
        const address = await tx.address.create({ data: data.address });
        addressId = address.id;

        createdAddress = {
          id: address.id,
          addressLine: address.addressLine,
          district: address.district,
          zipCode: address.zipCode,
          city: address.city,
          state: address.state,
        };
      }

      await tx.activityDetails.create({
        data: {
          activityId: activity.id,
          description: data.description,
          area: data.area,
          format: data.format,
          workloadHours: data.workloadHours,
          url: data.url ?? null,
          addressId,
        },
      });

      return {
        id: activity.id,
        authorId: activity.authorId,
        title: activity.title,
        type: activity.type,
        campus: activity.campus,
        startDate: activity.startDate,
        endDate: activity.endDate,
        slots: activity.slots,
        availableSlots: activity.slots,
        status: activity.status as ActivityStatus,
        details: {
          description: data.description,
          area: data.area,
          format: data.format,
          url: data.url ?? null,
          workloadHours: data.workloadHours,
          address: createdAddress,
        },
      };
    });
  }

  public async findById(id: string): Promise<ActivityFullResponse | null> {
    const [result, approvedCount] = await this._prisma.$transaction([
      this._prisma.activity.findUnique({
        where: { id, deletedAt: null },
        include: {
          details: {
            include: { address: true },
          },
        },
      }),
      this._prisma.enrollment.count({
        where: {
          activityId: id,
          status: ACTIVE_ENROLLMENT_STATUS,
        },
      }),
    ]);

    if (!result) return null;

    return toFullResponse(result, approvedCount);
  }

  public async listByUser(
    userId: string,
    filter: UserActivityFilter,
    page: number,
    limit: number,
  ): Promise<{ items: UserActivityResponse[]; total: number }> {
    const where = userActivityWhere(userId, filter);
    const skip = (page - 1) * limit;

    // The query schema bounds page from below only, so a huge page yields an
    // offset Prisma rejects (500). No row can live that far out: answer the
    // empty page past the last one that the contract promises.
    if (!Number.isSafeInteger(skip)) {
      return { items: [], total: await this._prisma.activity.count({ where }) };
    }

    const [rows, total] = await this._prisma.$transaction([
      this._prisma.activity.findMany({
        where,
        skip,
        take: limit,
        // id breaks startDate ties, so a page boundary never repeats or skips a row.
        orderBy: [{ startDate: "desc" }, { id: "asc" }],
        include: {
          details: { include: { address: true } },
          // @@unique([userId, activityId]) makes this at most one row.
          enrollments: {
            where: { userId },
            include: {
              certificate: {
                select: { id: true, validationCode: true, issuedAt: true },
              },
            },
          },
          _count: {
            select: {
              enrollments: { where: { status: ACTIVE_ENROLLMENT_STATUS } },
            },
          },
        },
      }),
      this._prisma.activity.count({ where }),
    ]);

    const items = rows.map(({ enrollments, _count, ...activity }) => {
      const enrollment = enrollments[0];
      const certificate = enrollment?.certificate;

      return {
        ...toFullResponse(activity, _count.enrollments),
        deletedAt: activity.deletedAt,
        enrollment: enrollment ? toEnrollmentResponse(enrollment) : null,
        certificate: certificate
          ? {
              id: certificate.id,
              validationCode: certificate.validationCode,
              issuedAt: certificate.issuedAt,
            }
          : null,
      };
    });

    return { items, total };
  }

  public async list(
    filters: IRepositoryListActivitiesFilters,
  ): Promise<IRepositoryListActivitiesResponse> {
    const {
      type,
      format,
      status,
      search,
      campus,
      area,
      page,
      limit,
      orderBy,
      order,
    } = filters;

    const whereClause: any = { deletedAt: null };

    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (campus) whereClause.campus = campus;

    if (format || area) {
      whereClause.details = {
        ...(format ? { format: format } : {}),
        ...(area ? { area: { equals: area, mode: "insensitive" } } : {}),
      };
    }

    if (search) {
      whereClause.title = {
        contains: search,
        mode: "insensitive",
      };
    }

    const skipRows = (page - 1) * limit;

    const [rawActivities, total] = await this._prisma.$transaction([
      this._prisma.activity.findMany({
        where: whereClause,
        skip: skipRows,
        take: limit,
        orderBy: { [orderBy]: order },
        include: {
          details: true,
          _count: {
            select: {
              enrollments: {
                where: { status: "APPROVED" },
              },
            },
          },
        },
      }),
      this._prisma.activity.count({ where: whereClause }),
    ]);

    const activities = rawActivities.map((a) => ({
      ...a,
      availableSlots: Math.max(0, a.slots - a._count.enrollments),
      _count: undefined,
    }));

    return {
      activities,
      total,
    };
  }

  public async listDistinctAreas(): Promise<string[]> {
    const rows = await this._prisma.activityDetails.groupBy({
      by: ["area"],
      where: {
        activity: {
          is: {
            deletedAt: null,
            status: { not: "CANCELLED" },
          },
        },
      },
    });

    const areas = rows.map((r) => r.area);

    const canonicalByKey = new Map<string, string>();
    for (const area of areas) {
      const key = area.toLowerCase();
      const current = canonicalByKey.get(key);
      if (current === undefined || area < current) {
        canonicalByKey.set(key, area);
      }
    }

    return Array.from(canonicalByKey.entries())
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([, canonicalArea]) => canonicalArea);
  }

  public async update(
    id: string,
    data: UpdateActivityInput,
    addressAction: "CREATE" | "UPDATE" | "DELETE" | "NONE",
  ): Promise<ActivityFullResponse> {
    return await this._prisma.$transaction(async (tx) => {
      const activityData = {
        title: data.title,
        type: data.type,
        campus: data.campus,
        startDate: data.startDate,
        endDate: data.endDate,
        slots: data.slots,
      };

      const detailsData = {
        description: data.description,
        area: data.area,
        format: data.format,
        url: data.url,
        workloadHours: data.workloadHours,
      };

      let addressUpdateQuery = {};

      if (addressAction === "DELETE") {
        addressUpdateQuery = {
          address: {
            delete: true,
          },
        };
      } else if (addressAction === "CREATE" && data.address) {
        addressUpdateQuery = {
          address: {
            create: {
              addressLine: data.address.addressLine,
              district: data.address.district,
              zipCode: data.address.zipCode,
              city: data.address.city,
              state: data.address.state,
            },
          },
        };
      } else if (addressAction === "UPDATE" && data.address) {
        addressUpdateQuery = {
          address: {
            update: {
              addressLine: data.address.addressLine,
              district: data.address.district,
              zipCode: data.address.zipCode,
              city: data.address.city,
              state: data.address.state,
            },
          },
        };
      }

      const updated = await tx.activity.update({
        where: { id },
        data: {
          ...activityData,
          details: {
            update: {
              ...detailsData,
              ...addressUpdateQuery,
            },
          },
        },
        include: {
          details: {
            include: {
              address: true,
            },
          },
        },
      });

      return updated as unknown as ActivityFullResponse;
    });
  }

  public async updateStatus(
    id: string,
    status: ActivityStatus,
  ): Promise<Activity> {
    return this._prisma.activity.update({
      where: { id },
      data: { status },
    });
  }

  public async countApprovedEnrollments(activityId: string): Promise<number> {
    return this._prisma.enrollment.count({
      where: {
        activityId,
        status: "APPROVED",
      },
    });
  }

  public async softDelete(id: string): Promise<boolean> {
    const result = await this._prisma.activity.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return result.count > 0;
  }
}

export default ActivityRepository;
