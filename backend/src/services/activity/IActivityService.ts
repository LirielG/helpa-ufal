import type { Activity } from "@prisma/client";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { activityResponse } from "@/types/activity.js";

export interface IActivityService {
  create(authorId: string, data: CreateActivityInput): Promise<activityResponse>;
  // prox metodos
  list(filters: IListActivitiesFilters, usuarioId?: string): Promise<IListActivitiesResponse>; // id opcional caso usuario esteja logado
}

export interface IListActivitiesFilters{
  tipo?: string;
  formato?: string;
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
  orderBy?: string;
  order?: string;
  campus?: string;
}

export interface IListActivitiesResponse{
  activities: activityResponse[];
  total: number;
}