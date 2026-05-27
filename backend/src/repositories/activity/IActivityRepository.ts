import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { ActivityFullResponse } from "@/types/activity.js";

export interface IActivityRepository {
  create(authorId: string, data: CreateActivityInput): Promise<Activity>;
  // prox metodos
  findById(id: string): Promise<ActivityFullResponse | null>;
}