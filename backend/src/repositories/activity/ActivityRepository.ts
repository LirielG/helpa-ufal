import type { PrismaClient, Activity, ActivityStatus} from "@prisma/client";
import type { IActivityRepository, IRepositoryListActivitiesFilters, IRepositoryListActivitiesResponse } from "@/repositories/activity/IActivityRepository.js";
import type { CreateActivityInput, UpdateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { prisma } from "@/database/prisma.js";    
import { ActivityFullResponse } from "@/types/activity.js";

type Props = {
  prisma?: PrismaClient;
};

class ActivityRepository implements IActivityRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async create(
    authorId: string,
    data: CreateActivityInput,
  ): Promise<Activity> {
    
    return this._prisma.$transaction(async (tx) => {

      const activity = await tx.activity.create({
        data: {
          authorId,
          title:     data.title,
          type:      data.type,
          campus:    data.campus,
          startDate: data.startDate,
          endDate:   data.endDate,
          slots:     data.slots,
          status:    "OPEN",
        },
      });

      let addressId: string | null = null;

      if (data.address) {
        const address = await tx.address.create({ data: data.address });
        addressId = address.id;
      }

      await tx.activityDetails.create({
        data: {
          activityId:    activity.id,
          description:   data.description,
          area:          data.area,
          format:        data.format,
          workloadHours: data.workloadHours,
          url:           data.url ?? null,
          addressId,
        },
      });

      return activity;
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
          status: "APPROVED",
        },
      }),
    ]);

    if (!result) return null;

    return {
      id:        result.id,
      authorId:  result.authorId,
      title:     result.title,
      type:      result.type,
      campus:    result.campus,
      startDate: result.startDate,
      endDate:   result.endDate,
      slots:     result.slots,
      availableSlots: Math.max(0, result.slots - approvedCount),
      status:    result.status,
      details:   result.details
        ? {
            description:   result.details.description,
            area:          result.details.area,
            format:        result.details.format,
            url:           result.details.url ?? null,
            workloadHours: result.details.workloadHours,
            address:       result.details.address
              ? {
                  id:          result.details.address.id,
                  addressLine: result.details.address.addressLine,
                  district:    result.details.address.district,
                  zipCode:     result.details.address.zipCode,
                  city:        result.details.address.city,
                  state:       result.details.address.state,
                }
              : null,
          }
        : null,
    };
  }
  
  public async list(
    filters: IRepositoryListActivitiesFilters
  ): Promise<IRepositoryListActivitiesResponse> {
    const {type, format, status, search, campus, page, limit, orderBy, order} = filters;

    const whereClause: any = { deletedAt: null };

    if(type)whereClause.type = type;
    if(status)whereClause.status = status;
    if(campus)whereClause.campus = campus;

    if(format){
      whereClause.details = {
        format: format,
      };
    }

    if(search){
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
          _count: {                              // NOVO
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

  public async update(
    id: string,
    data: UpdateActivityInput,
    addressAction: "CREATE" | "UPDATE" | "DELETE" | "NONE"
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

  public async updateStatus(id: string, status: ActivityStatus): Promise<Activity> {
    return this._prisma.activity.update({
      where: { id },
      data: { status },
    });
  }

  public async findUserById(id: string): Promise<{ isManager: boolean } | null> {
    return this._prisma.user.findUnique({
      where: { id },
      select: { isManager: true },
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
  
}
export default ActivityRepository;
