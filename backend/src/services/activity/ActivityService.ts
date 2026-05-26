import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { CreateActivityInput } from "@/schemas/activity/ActivitySchemas.js";
import type { IListActivitiesFilters, IListActivitiesResponse } from "./IActivityService.js";
import type { Activity } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";
import { ActivityResponse } from "@/types/activity.js";
import ValidationError, { ValidationErrorItem } from "@/models/error/ValidationError.js";



const MAX_ACTIVITY_DURATION_DAYS = 365; // 1 years
const MAX_SLOTS                  = 10_000;
const MAX_WORKLOAD_HOURS         = 8_760; // hours in a year
const MAX_FUTURE_START_DAYS      = 365;   // 1 years ahead

type Props = {
  activityRepository?: IActivityRepository;
};

class ActivityService implements IActivityService {
  private _activityRepository: IActivityRepository;

  constructor(props?: Props) {
    this._activityRepository = props?.activityRepository ?? new ActivityRepository();
  }

  public async create(
    authorId: string,
    data: CreateActivityInput,
  ): Promise<ActivityResponse> {
    
    const now = new Date();
    const durationDays =
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysUntilStart =
      (data.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const durationHours = durationDays * 24;
    
    const dateErrors = [];

    if (data.startDate <= now) {
      dateErrors.push({
        "field": "startDate",
        "message": "startDate must be in the future.",
      } as ValidationErrorItem )
    }

    if (data.endDate <= data.startDate) {
      dateErrors.push({
        "field": "endDate",
        "message": "endDate must be after startDate.",
      } as ValidationErrorItem )
    }


    if (durationDays > MAX_ACTIVITY_DURATION_DAYS) {
      dateErrors.push({
        "field": "endDate",
        "message": `Activity duration cannot exceed ${MAX_ACTIVITY_DURATION_DAYS} days.`,
      } as ValidationErrorItem )
    }


    if (daysUntilStart > MAX_FUTURE_START_DAYS) {
      dateErrors.push({
        "field": "startDate",
        "message": `startDate cannot be more than ${MAX_FUTURE_START_DAYS} days in the future.`,
      } as ValidationErrorItem )
    }

    if (dateErrors.length > 0) throw new ValidationError(dateErrors);

    const capacityErrors = [];

    if (data.workloadHours > durationHours)
    capacityErrors.push({ field: "workloadHours", message: "workloadHours cannot exceed the total duration of the activity." });

    if (data.workloadHours > MAX_WORKLOAD_HOURS)
    capacityErrors.push({ field: "workloadHours", message: `workloadHours cannot exceed ${MAX_WORKLOAD_HOURS}.` });

    if (data.slots > MAX_SLOTS)
    capacityErrors.push({ field: "slots", message: `slots cannot exceed ${MAX_SLOTS}.` });

    if (capacityErrors.length > 0) throw new ValidationError(capacityErrors);


    if (data.format === "IN_PERSON" && !data.address) {
      throw new CustomError(400, "IN_PERSON activities require an address.");
    }

    if (data.format === "HYBRID" && !data.address) {
      throw new CustomError(400, "HYBRID activities require an address.");
    }

    if (data.format === "HYBRID" && !data.url) {
      throw new CustomError(400, "HYBRID activities require a url.");
    }
    
    const newActivity = await this._activityRepository.create(authorId, data);

    const activityResponse: ActivityResponse = {
      "id": newActivity.id,
      "authorId": newActivity.authorId,
      "title": newActivity.title,
      "type": newActivity.type,
      "campus": newActivity.campus,
      "startDate": newActivity.startDate,
      "endDate": newActivity.endDate,
      "slots": newActivity.slots,
      "status": newActivity.status,
    }
    
    return activityResponse;
  }

  public async list(
    filters: IListActivitiesFilters,
    usuarioId?: string
  ): Promise<IListActivitiesResponse> {

    const pageRaw = filters.page ?? "1";
    const limitRaw = filters.limit ?? "10";

    const pageNum = parseInt(pageRaw, 10);
    const limitNum = parseInt(limitRaw, 10);

    const paginationErrors = [];

    if(isNaN(pageNum) || pageNum < 1){
      paginationErrors.push({
        field: "page",
        message: "page must be a positive integer.",
      } as ValidationErrorItem)
    }

    if (isNaN(limitNum) || limitNum < 1){
      paginationErrors.push({
        field: "limit",
        message: "limit must be a positive integer.",
      } as ValidationErrorItem)
    } else if (limitNum > 50){
      paginationErrors.push({
        field: "limit",
        message:"limit can not exceed 50."
      } as ValidationErrorItem)
    }

    if(paginationErrors.length > 0){
      throw new ValidationError(paginationErrors);
    }

    // filtros
    const filterErrors = [];

    const validTypes     = ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"];
    const validFormats   = ["IN_PERSON", "ONLINE", "HYBRID"];
    const validStatuses  = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];


    if (filters.type && !validTypes.includes(filters.type)) {
      filterErrors.push({
        field: "tipo",
        message: `tipo must be one of the following: ${validTypes.join(", ")}.`,
      } as ValidationErrorItem);
    }

    if (filters.format && !validFormats.includes(filters.format)) {
      filterErrors.push({
        field: "formato",
        message: `formato must be one of the following: ${validFormats.join(", ")}.`,
      } as ValidationErrorItem);
    }

    if (filters.status && !validStatuses.includes(filters.status)) {
      filterErrors.push({
        field: "status",
        message: `status must be one of the following: ${validStatuses.join(", ")}.`,
      } as ValidationErrorItem);
    }

    const validOrders = ["asc", "desc"];
    const validSortFields = ["start_date", "created_at"];

    if(filters.order && !validOrders.includes(filters.order)){
      filterErrors.push({
        field: "order",
        message: `order must be one of the following: ${validOrders.join(",")}.`,
      } as ValidationErrorItem)
    }

    if(filters.orderBy && !validSortFields.includes(filters.orderBy)){
      filterErrors.push({
        field: "orderBy",
        message: `orderBy must be one of the following: ${validSortFields.join(",")}.`,
      } as ValidationErrorItem)
    }

    if (filterErrors.length > 0) {
      throw new ValidationError(filterErrors);
    }

    let sortField = "createdAt";

    if (filters.orderBy === "data_inicio") {
      sortField = "startDate";
    } else if (filters.orderBy === "created_at") {
      sortField = "createdAt";
    }

    const result = await this._activityRepository.list({
      type: filters.type,
      format: filters.format,
      status: filters.status,
      search: filters.search,
      campus: filters.campus,
      page: pageNum,                 
      limit: limitNum,               
      orderBy: sortField,            
      order: filters.order ?? "desc"
    });
    
    return result;
  }
}

export default ActivityService;