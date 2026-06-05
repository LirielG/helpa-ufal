import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { ActivityFullResponse } from "@/types/activity.js";

export interface IActivityRepository {
  create(authorId: string, data: CreateActivityInput): Promise<Activity>;
  // prox metodos
  findById(id: string): Promise<ActivityFullResponse | null>;

  list(filters: IRepositoryListActivitiesFilters): Promise<IRepositoryListActivitiesResponse>;
}

export interface IRepositoryListActivitiesFilters{
  type?: string;
  format?: string;
  status?: string;
  search?: string;
  campus?: string;
  page: number;      
  limit: number;     
  orderBy: string;  
  order: "asc" | "desc";
}

export interface IRepositoryListActivitiesResponse{
  activities: Activity[];
  total: number;
}