import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { activityResponse } from "@/types/activity.js";

export interface IActivityService {
  create(authorId: string, data: CreateActivityInput): Promise<activityResponse>;
  // prox metodos
}