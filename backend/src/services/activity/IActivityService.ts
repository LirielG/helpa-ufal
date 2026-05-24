import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";

export interface IActivityService {
  create(authorId: string, data: CreateActivityInput): Promise<Activity>;
  // prox metodos
}