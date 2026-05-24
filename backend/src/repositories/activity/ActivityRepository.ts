import type { PrismaClient, Activity } from "@prisma/client";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { prisma } from "@/database/prisma.js";

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
}

export default ActivityRepository;