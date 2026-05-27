import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { ActivityFullResponse, ActivityResponse } from "@/types/activity.js";

export interface IActivityService {
  create(authorId: string, data: CreateActivityInput): Promise<ActivityResponse>;
  // prox metodos
  list(filters: IListActivitiesFilters, usuarioId?: string): Promise<IListActivitiesResponse>; // id opcional caso usuario esteja logado
  findById(id: string): Promise<ActivityFullResponse>;
  
}

export interface IListActivitiesFilters{
  type?: string;
  format?: string;
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
  orderBy?: string;
  order?: string;
  campus?: string;
}

export interface IListActivitiesResponse{
  activities: ActivityResponse[];
  total: number;
}