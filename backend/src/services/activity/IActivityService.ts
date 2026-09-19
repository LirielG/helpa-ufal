import type { Activity } from "@prisma/client";
import type { CreateActivityInput, UpdateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import { ActivityFullResponse, ActivityResponse, ActivityStatus, ActivityFilterOptions } from "@/types/activity.js";

export interface IActivityService {
  create(authorId: string, data: CreateActivityInput): Promise<ActivityResponse>;
  list(filters: IListActivitiesFilters, usuarioId?: string): Promise<IListActivitiesResponse>; 
  findById(id: string): Promise<ActivityFullResponse>;
  update(id: string, userId: string, data: UpdateActivityInput): Promise<ActivityFullResponse>;
  updateStatus(activityId: string, newStatus: ActivityStatus, userId: string): Promise<ActivityResponse>;
  delete(id: string, userId: string): Promise<void>
  listFilterOptions(): Promise<ActivityFilterOptions>;
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
  area?: string;
}

export interface IListActivitiesResponse{
  activities: ActivityResponse[];
  total: number;
}