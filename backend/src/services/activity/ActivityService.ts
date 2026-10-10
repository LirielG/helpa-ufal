import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type {
  CreateActivityInput,
  UpdateActivityInput,
} from "@/schemas/activity/ActivitySchemas.js";
import { isValidTransition } from "@/schemas/activity/ActivitySchemas.js";
import type {
  IListActivitiesFilters,
  IListActivitiesResponse,
} from "./IActivityService.js";
import type { Activity } from "@prisma/client";
import { CampusLocation } from "@prisma/client";
import CustomError from "@/models/error/CustomError.js";
import {
  ActivityFullResponse,
  ActivityResponse,
  ActivityStatus,
  ActivityFilterOptions,
} from "@/types/activity.js";
import ValidationError, {
  ValidationErrorItem,
} from "@/models/error/ValidationError.js";
import { isValidUUID } from "@/utils/uuid.js";

const MAX_ACTIVITY_DURATION_DAYS = 365; // 1 years
const MAX_SLOTS = 10_000;
const MAX_WORKLOAD_HOURS = 8_760; // hours in a year
const MAX_FUTURE_START_DAYS = 365; // 1 years ahead

// `page` and `limit` accept only plain digits. parseInt() alone is too
// lenient: it turns "10.9" into 10 and "20abc" into 20 without any warning.
const STRICT_INTEGER_PATTERN = /^\d+$/;

function isStrictIntegerString(value: unknown): value is string {
  return typeof value === "string" && STRICT_INTEGER_PATTERN.test(value);
}

// A filter is invalid when it is PRESENT but not one of the accepted values.
// "Present" means anything other than `undefined`: an empty `?type=` is a
// present-and-invalid value (400), not an absent filter. A non-string value
// (e.g. `?type=A&type=B`, which Express parses as an array) is invalid too.
function isInvalidFilterValue(
  value: unknown,
  allowed: readonly string[],
): boolean {
  if (value === undefined) return false;
  return typeof value !== "string" || !allowed.includes(value);
}

type Props = {
  activityRepository?: IActivityRepository;
  userRepository?: IUserRepository;
};

class ActivityService implements IActivityService {
  private _activityRepository: IActivityRepository;
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  public async create(
    authorId: string,
    data: CreateActivityInput,
  ): Promise<ActivityResponse> {
    const now = new Date();
    const durationDays =
      (data.endDate.getTime() - data.startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const daysUntilStart =
      (data.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const durationHours = durationDays * 24;

    const dateErrors = [];

    if (data.startDate <= now) {
      dateErrors.push({
        field: "startDate",
        message: "startDate must be in the future.",
      } as ValidationErrorItem);
    }

    if (data.endDate <= data.startDate) {
      dateErrors.push({
        field: "endDate",
        message: "endDate must be after startDate.",
      } as ValidationErrorItem);
    }

    if (durationDays > MAX_ACTIVITY_DURATION_DAYS) {
      dateErrors.push({
        field: "endDate",
        message: `Activity duration cannot exceed ${MAX_ACTIVITY_DURATION_DAYS} days.`,
      } as ValidationErrorItem);
    }

    if (daysUntilStart > MAX_FUTURE_START_DAYS) {
      dateErrors.push({
        field: "startDate",
        message: `startDate cannot be more than ${MAX_FUTURE_START_DAYS} days in the future.`,
      } as ValidationErrorItem);
    }

    if (dateErrors.length > 0) throw new ValidationError(dateErrors);

    const capacityErrors = [];

    if (data.workloadHours > durationHours)
      capacityErrors.push({
        field: "workloadHours",
        message:
          "workloadHours cannot exceed the total duration of the activity.",
      });

    if (data.workloadHours > MAX_WORKLOAD_HOURS)
      capacityErrors.push({
        field: "workloadHours",
        message: `workloadHours cannot exceed ${MAX_WORKLOAD_HOURS}.`,
      });

    if (data.slots > MAX_SLOTS)
      capacityErrors.push({
        field: "slots",
        message: `slots cannot exceed ${MAX_SLOTS}.`,
      });

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
      id: newActivity.id,
      authorId: newActivity.authorId,
      title: newActivity.title,
      type: newActivity.type,
      campus: newActivity.campus,
      startDate: newActivity.startDate,
      endDate: newActivity.endDate,
      slots: newActivity.slots,
      availableSlots: newActivity.slots,
      status: newActivity.status,
    };

    return activityResponse;
  }

  public async list(
    filters: IListActivitiesFilters,
    userId?: string,
  ): Promise<IListActivitiesResponse> {
    // Absent -> default. Present (even empty) -> must be a plain integer.
    const pageRaw: unknown = filters.page ?? "1";
    const limitRaw: unknown = filters.limit ?? "20";

    const pageNum = isStrictIntegerString(pageRaw) ? Number(pageRaw) : NaN;
    const limitNum = isStrictIntegerString(limitRaw) ? Number(limitRaw) : NaN;

    const paginationErrors = [];

    if (isNaN(pageNum) || pageNum < 1) {
      paginationErrors.push({
        field: "page",
        message: "page must be a positive integer.",
      } as ValidationErrorItem);
    }

    if (isNaN(limitNum) || limitNum < 1) {
      paginationErrors.push({
        field: "limit",
        message: "limit must be a positive integer.",
      } as ValidationErrorItem);
    } else if (limitNum > 100) {
      paginationErrors.push({
        field: "limit",
        message: "limit can not exceed 100.",
      } as ValidationErrorItem);
    }

    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors);
    }

    const filterErrors = [];

    const validTypes = ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"];
    const validFormats = ["IN_PERSON", "ONLINE", "HYBRID"];
    const validStatuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

    // Derived from the Prisma enum (never hand-written): campus is a DB enum
    // column, so an unknown value would otherwise blow up in the driver (500).
    const validCampuses: readonly string[] = Object.values(CampusLocation);

    if (isInvalidFilterValue(filters.type, validTypes)) {
      filterErrors.push({
        field: "type",
        message: `type must be one of the following: ${validTypes.join(", ")}.`,
      } as ValidationErrorItem);
    }

    if (isInvalidFilterValue(filters.format, validFormats)) {
      filterErrors.push({
        field: "format",
        message: `format must be one of the following: ${validFormats.join(", ")}.`,
      } as ValidationErrorItem);
    }

    if (isInvalidFilterValue(filters.status, validStatuses)) {
      filterErrors.push({
        field: "status",
        message: `status must be one of the following: ${validStatuses.join(", ")}.`,
      } as ValidationErrorItem);
    }

    // `search` is deliberately NOT validated: it is free text.
    if (isInvalidFilterValue(filters.campus, validCampuses)) {
      filterErrors.push({
        field: "campus",
        message: `campus must be one of the following: ${validCampuses.join(", ")}.`,
      } as ValidationErrorItem);
    }

    const validOrders = ["asc", "desc"];
    const validSortFields = ["start_date", "created_at"];

    if (isInvalidFilterValue(filters.order, validOrders)) {
      filterErrors.push({
        field: "order",
        message: `order must be one of the following: ${validOrders.join(",")}.`,
      } as ValidationErrorItem);
    }

    if (isInvalidFilterValue(filters.orderBy, validSortFields)) {
      filterErrors.push({
        field: "orderBy",
        message: `orderBy must be one of the following: ${validSortFields.join(",")}.`,
      } as ValidationErrorItem);
    }

    if (filterErrors.length > 0) {
      throw new ValidationError(filterErrors);
    }

    let sortField = "createdAt";

    if (filters.orderBy === "start_date") {
      sortField = "startDate";
    } else if (filters.orderBy === "created_at") {
      sortField = "createdAt";
    }
    const trimmedArea = filters.area?.trim();
    const result = await this._activityRepository.list({
      type: filters.type,
      format: filters.format,
      status: filters.status,
      search: filters.search,
      campus: filters.campus,
      area: trimmedArea ? trimmedArea : undefined,
      page: pageNum,
      limit: limitNum,
      orderBy: sortField,
      order: (filters.order ?? "desc") as "asc" | "desc",
    });

    return result;
  }

  public async listFilterOptions(): Promise<ActivityFilterOptions> {
    const areas = await this._activityRepository.listDistinctAreas();
    return { areas };
  }

  public async findById(id: string): Promise<ActivityFullResponse> {
    if (!isValidUUID(id)) {
      throw new ValidationError([
        { field: "id", message: "id must be a valid UUID." },
      ]);
    }

    const activity = await this._activityRepository.findById(id);

    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    return activity;
  }

  public async update(
    id: string,
    userId: string,
    data: UpdateActivityInput,
  ): Promise<ActivityFullResponse> {
    const activity = await this._activityRepository.findById(id);

    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    const dbUser = await this._userRepository.findById(userId);
    const isAuthor = !!dbUser && activity.authorId === userId;
    const isManager = dbUser?.isManager ?? false;

    if (!isAuthor && !isManager) {
      throw new CustomError(
        403,
        "You do not have permission to update this activity.",
      );
    }

    if (activity.status === "COMPLETED" || activity.status === "CANCELLED") {
      throw new CustomError(
        409,
        `Activity cannot be updated because it is already ${activity.status}.`,
      );
    }

    const now = new Date();

    const finalStartDate = data.startDate ?? activity.startDate;
    const finalEndDate = data.endDate ?? activity.endDate;

    if (data.startDate || data.endDate) {
      const dateErrors: ValidationErrorItem[] = [];
      const durationDays =
        (finalEndDate.getTime() - finalStartDate.getTime()) /
        (1000 * 60 * 60 * 24);
      const daysUntilStart =
        (finalStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (data.startDate && finalStartDate <= now) {
        dateErrors.push({
          field: "startDate",
          message: "startDate must be in the future.",
        });
      }

      if (finalEndDate <= finalStartDate) {
        dateErrors.push({
          field: "endDate",
          message: "endDate must be after startDate.",
        });
      }

      if (durationDays > MAX_ACTIVITY_DURATION_DAYS) {
        dateErrors.push({
          field: "endDate",
          message: `Activity duration cannot exceed ${MAX_ACTIVITY_DURATION_DAYS} days.`,
        });
      }

      if (data.startDate && daysUntilStart > MAX_FUTURE_START_DAYS) {
        dateErrors.push({
          field: "startDate",
          message: `startDate cannot be more than ${MAX_FUTURE_START_DAYS} days in the future.`,
        });
      }

      if (dateErrors.length > 0) throw new ValidationError(dateErrors);
    }

    const finalWorkloadHours =
      data.workloadHours ?? activity.details?.workloadHours ?? 0;
    const durationDays =
      (finalEndDate.getTime() - finalStartDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const durationHours = durationDays * 24;

    if (data.workloadHours || data.startDate || data.endDate) {
      const capacityErrors = [];

      if (finalWorkloadHours > durationHours) {
        capacityErrors.push({
          field: "workloadHours",
          message:
            "workloadHours cannot exceed the total duration of the activity.",
        });
      }

      if (finalWorkloadHours > MAX_WORKLOAD_HOURS) {
        capacityErrors.push({
          field: "workloadHours",
          message: `workloadHours cannot exceed ${MAX_WORKLOAD_HOURS}.`,
        });
      }

      if (capacityErrors.length > 0) throw new ValidationError(capacityErrors);
    }

    if (data.slots !== undefined) {
      if (data.slots > MAX_SLOTS) {
        throw new ValidationError([
          { field: "slots", message: `slots cannot exceed ${MAX_SLOTS}.` },
        ]);
      }

      const approvedEnrollments = activity.slots - activity.availableSlots;
      if (data.slots < approvedEnrollments) {
        throw new ValidationError([
          {
            field: "slots",
            message: `slots cannot be reduced below the current number of approved enrollments (${approvedEnrollments}).`,
          },
        ]);
      }
    }

    const finalFormat = data.format ?? activity.details?.format;
    // `url: null` clears the stored url, so only an absent field falls back to it.
    const finalUrl = data.url !== undefined ? data.url : activity.details?.url;

    if (finalFormat === "HYBRID" && !finalUrl) {
      throw new CustomError(400, "HYBRID activities require a url.");
    }

    let addressAction: "CREATE" | "UPDATE" | "DELETE" | "NONE" = "NONE";
    const hasExistingAddress = !!activity.details?.address;

    if (finalFormat === "ONLINE") {
      data.address = null;
      if (hasExistingAddress) addressAction = "DELETE";
    } else {
      if (data.address) {
        addressAction = hasExistingAddress ? "UPDATE" : "CREATE";
      } else if (!hasExistingAddress && data.format) {
        throw new CustomError(
          400,
          `${finalFormat} activities require an address.`,
        );
      }
    }

    const updatedActivity = await this._activityRepository.update(
      id,
      data,
      addressAction,
    );

    return updatedActivity;
  }

  public async updateStatus(
    activityId: string,
    newStatus: ActivityStatus,
    userId: string,
  ): Promise<ActivityResponse> {
    const activity = await this._activityRepository.findById(activityId);

    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    const user = await this._userRepository.findById(userId);
    const isAuthor = !!user && activity.authorId === userId; // A valid JWT of a deleted/deactivated user must not authorize anything.
    const isManager = user?.isManager ?? false;

    if (!isAuthor && !isManager) {
      throw new CustomError(
        403,
        "Forbidden. Requester is not the author or a manager.",
      );
    }

    const currentStatus = activity.status;

    if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
      throw new CustomError(
        409,
        `Activity is already ${currentStatus} and cannot be transitioned.`,
      );
    }

    if (!isValidTransition(currentStatus, newStatus)) {
      throw new CustomError(
        409,
        `Cannot transition from ${currentStatus} to ${newStatus}.`,
      );
    }

    const updated = await this._activityRepository.updateStatus(
      activityId,
      newStatus as any,
    );

    const approvedCount =
      await this._activityRepository.countApprovedEnrollments(activityId);

    const activityResponse: ActivityResponse = {
      id: updated.id,
      authorId: updated.authorId,
      title: updated.title,
      type: updated.type,
      campus: updated.campus,
      startDate: updated.startDate,
      endDate: updated.endDate,
      slots: updated.slots,
      availableSlots: Math.max(0, updated.slots - approvedCount),
      status: updated.status,
    };

    return activityResponse;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const activity = await this._activityRepository.findById(id);

    if (!activity) {
      throw new CustomError(404, "Activity not found.");
    }

    const user = await this._userRepository.findById(userId);
    const isAuthor = !!user && activity.authorId === userId;
    const isManager = user?.isManager ?? false;

    if (!isAuthor && !isManager) {
      throw new CustomError(
        403,
        "You do not have permission to delete this activity.",
      );
    }

    await this._activityRepository.softDelete(id);
  }
}

export default ActivityService;
