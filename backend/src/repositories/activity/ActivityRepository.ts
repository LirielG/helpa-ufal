import type { PrismaClient, Activity } from "@prisma/client";
import type { IActivityRepository, IRepositoryListActivitiesFilters, IRepositoryListActivitiesResponse } from "@/repositories/activity/IActivityRepository.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
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
    const result = await this._prisma.activity.findUnique({
      where:   { id },
      include: {
        details: {
          include: { address: true },
        },
      },
    });

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

    const whereClause: any = {};

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

    const[activities, total] = await this._prisma.$transaction([
      this._prisma.activity.findMany({
        where: whereClause,
        skip: skipRows,
        take: limit,
        orderBy:{
          [orderBy]: order,
        },
        include: {
          details: true,
        },
      }),
      this._prisma.activity.count({
        where: whereClause,
      }),
    ]);

    return {
      activities,
      total,
    };
  }
}

export default ActivityRepository;