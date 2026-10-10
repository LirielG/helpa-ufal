import { describe, it, expect, vi } from "vitest";
import { CampusLocation } from "@prisma/client";
import ActivityService from "../ActivityService.js";
import type { IListActivitiesFilters } from "../IActivityService.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import ValidationError from "@/models/error/ValidationError.js";

function mockRepository(
  overrides: Partial<IActivityRepository> = {},
): IActivityRepository {
  return {
    list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    ...overrides,
  } as unknown as IActivityRepository;
}

async function captureValidationError(
  promise: Promise<unknown>,
): Promise<ValidationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    const validationError = error as ValidationError;
    expect(validationError.statusCode).toBe(400);
    expect(validationError.message).toBe("Validation error.");
    return validationError;
  }
  throw new Error("Expected a ValidationError, but nothing was thrown.");
}

describe("ActivityService.list", () => {
  // ---------- Pagination ----------

  it("applies the defaults `page: 1` and `limit: 20` when not specified", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({});

    expect(repository.list).toHaveBeenCalledWith({
      type: undefined,
      format: undefined,
      status: undefined,
      search: undefined,
      campus: undefined,
      page: 1,
      limit: 20,
      orderBy: "createdAt",
      order: "desc",
    });
  });

  it("Rejects non-numeric 'page' value with an error in the 'page' field.", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(service.list({ page: "abc" }));

    expect(error.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects a page value less than 1 with an error in the 'page' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(service.list({ page: "0" }));

    expect(error.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("Rejects a limit of less than 1 with an error in the limit field.", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(service.list({ limit: "0" }));

    expect(error.errors).toEqual([
      { field: "limit", message: "limit must be a positive integer." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("Rejects a limit above 100 with an error in the limit field.", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(service.list({ limit: "101" }));

    expect(error.errors).toEqual([
      { field: "limit", message: "limit can not exceed 100." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("accepts the limit at the ceiling (100) and passes it on to the repository", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ limit: "100" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 }),
    );
  });

  // Issue #210: used to be "silently truncates a non-integer limit ('10.9'
  // becomes 10)". The expectation flipped on purpose — this is the record of
  // the decision that fractional / suffixed numbers are now rejected.
  it.each(["10.9", "20abc", "1e2", "-5", "+5", " 5", ""])(
    "rejects the non-integer limit %j with an error in the 'limit' field",
    async (limit) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      const error = await captureValidationError(service.list({ limit }));

      expect(error.errors).toEqual([
        { field: "limit", message: "limit must be a positive integer." },
      ]);
      expect(repository.list).not.toHaveBeenCalled();
    },
  );

  it.each(["2.5", "1abc", "1e1", "-1", "+1", " 1", ""])(
    "rejects the non-integer page %j with an error in the 'page' field",
    async (page) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      const error = await captureValidationError(service.list({ page }));

      expect(error.errors).toEqual([
        { field: "page", message: "page must be a positive integer." },
      ]);
      expect(repository.list).not.toHaveBeenCalled();
    },
  );

  it("rejects a repeated limit (?limit=1&limit=2 arrives as an array)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ limit: ["1", "2"] } as unknown as IListActivitiesFilters),
    );

    expect(error.errors).toEqual([
      { field: "limit", message: "limit must be a positive integer." },
    ]);
  });

  it("still applies the defaults when page and limit are ABSENT (not empty)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ page: undefined, limit: undefined });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("converts valid page and limit values ​​to numbers when passing them along", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ page: "2", limit: "5" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
    );
  });

  it("aggregates page and limit errors into a single ValidationError", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ page: "0", limit: "0" }),
    );

    expect(error.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
      { field: "limit", message: "limit must be a positive integer." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  // ---------- Filters ----------

  it("rejects invalid status with an error in the 'status' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ status: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "status",
        message:
          "status must be one of the following: OPEN, IN_PROGRESS, COMPLETED, CANCELLED.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects invalid order with an error in the 'order' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ order: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "order",
        message: "order must be one of the following: asc,desc.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects invalid orderBy with an error on the 'orderBy' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ orderBy: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "orderBy",
        message: "orderBy must be one of the following: start_date,created_at.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it.each(["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"])(
    "repassa o type válido %s ao repositório",
    async (type) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      await service.list({ type });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ type }),
      );
    },
  );

  it.each(["IN_PERSON", "ONLINE", "HYBRID"])(
    "repassa o format válido %s ao repositório",
    async (format) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      await service.list({ format });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ format }),
      );
    },
  );

  it.each(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"])(
    "repassa o status válido %s ao repositório",
    async (status) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      await service.list({ status });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
    },
  );

  it.each(["asc", "desc"])(
    "repassa o order válido %s ao repositório",
    async (order) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      await service.list({ order });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ order }),
      );
    },
  );

  it("aggregates multiple filter errors into a single ValidationError", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ type: "INVALIDO", status: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "type",
        message:
          "type must be one of the following: EXTENSION, COURSE, EVENT, LECTURE, OTHER.",
      },
      {
        field: "status",
        message:
          "status must be one of the following: OPEN, IN_PROGRESS, COMPLETED, CANCELLED.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  // Issue #210: used to be "treats an empty type ('') as missing and passes it
  // through as-is". A PRESENT-but-empty filter is now a validation error;
  // only an ABSENT one (undefined) means "no filter".
  it.each(["type", "format", "status", "campus", "order", "orderBy"] as const)(
    "rejects an empty '%s' with an error in that field (present-and-empty is not absent)",
    async (field) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      const error = await captureValidationError(
        service.list({ [field]: "" } as IListActivitiesFilters),
      );

      expect(error.errors).toHaveLength(1);
      expect(error.errors[0].field).toBe(field);
      expect(repository.list).not.toHaveBeenCalled();
    },
  );

  it("keeps the exact message format for an empty type", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(service.list({ type: "" }));

    expect(error.errors).toEqual([
      {
        field: "type",
        message:
          "type must be one of the following: EXTENSION, COURSE, EVENT, LECTURE, OTHER.",
      },
    ]);
  });

  it("treats an ABSENT type (undefined) as no filter and does not filter by it", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ type: undefined });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined }),
    );
  });

  it("rejects a repeated filter (?type=COURSE&type=EVENT arrives as an array)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ type: ["COURSE", "EVENT"] } as unknown as IListActivitiesFilters),
    );

    expect(error.errors).toHaveLength(1);
    expect(error.errors[0].field).toBe("type");
  });

  it("keeps 'area' and 'search' free-text: empty values are NOT errors", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ area: "", search: "" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ area: undefined, search: "" }),
    );
  });

  // ---------- Precedence: pagination before filters ----------

  it("reports only the pagination error when pagination and filters are invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ page: "0", type: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  // ---------- Repository forwarding ----------

  it("maps orderBy: 'created_at' to 'createdAt'", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "created_at" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: "createdAt" }),
    );
  });

  it("maps start_date to startDate and passes it to repository.list", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "start_date" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "startDate",
      }),
    );
  });

  it("maps created_at to createdAt and passes it to repository.list", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "created_at" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "createdAt",
      }),
    );
  });

  it("throws a ValidationError with status 400 and field 'type' when filter.type is invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expect(
      service.list({ type: "INVALID_TYPE" as any }),
    ).rejects.toSatisfy((error: any) => {
      expect(error.statusCode ?? error.status).toBe(400);
      expect(error.errors?.[0]?.field).toBe("type");
      return true;
    });
  });

  it("throws a ValidationError with status 400 and field 'format' when filter.format is invalid", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await expect(
      service.list({ format: "INVALID_FORMAT" as any }),
    ).rejects.toSatisfy((error: any) => {
      expect(error.statusCode ?? error.status).toBe(400);
      expect(error.errors?.[0]?.field).toBe("format");
      return true;
    });
  });

  // Issue #211: used to be "passes search and campus to the repository without
  // validation". `search` is free text and stays unvalidated by decision;
  // `campus` is a DB enum column and is now validated against CampusLocation.
  it("passes search to the repository without validation (free text)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ search: "  robótica  " });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: "  robótica  " }),
    );
  });

  it.each(Object.values(CampusLocation))(
    "forwards the valid campus %s to the repository",
    async (campus) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      await service.list({ campus });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ campus }),
      );
    },
  );

  it.each(["INVALIDO", "maceio", "MACEIÓ", "Arapiraca", " ARAPIRACA", "NAO_E_UM_CAMPUS"])(
    "rejects the campus %j with an error in the 'campus' field (never reaches the repository)",
    async (campus) => {
      const repository = mockRepository();
      const service = new ActivityService({ activityRepository: repository });

      const error = await captureValidationError(service.list({ campus }));

      expect(error.errors).toEqual([
        {
          field: "campus",
          message: `campus must be one of the following: ${Object.values(CampusLocation).join(", ")}.`,
        },
      ]);
      expect(repository.list).not.toHaveBeenCalled();
    },
  );

  it("lists every campus of the Prisma enum in the message (derived, not hand-written)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ campus: "INVALIDO" }),
    );

    for (const campus of Object.values(CampusLocation)) {
      expect(error.errors[0].message).toContain(campus);
    }
  });

  it("aggregates an invalid campus and an invalid type into a single ValidationError with two items", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ type: "INVALIDO", campus: "INVALIDO" }),
    );

    expect(error.errors.map((e) => e.field)).toEqual(["type", "campus"]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("does not pass unknown parameters (startAfter/endBefore) to the repository", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({
      startAfter: "2026-01-01",
      endBefore: "2026-12-31",
    } as unknown as IListActivitiesFilters);

    expect(repository.list).toHaveBeenCalledWith({
      type: undefined,
      format: undefined,
      status: undefined,
      search: undefined,
      campus: undefined,
      page: 1,
      limit: 20,
      orderBy: "createdAt",
      order: "desc",
    });
  });

  it("constructs the complete filter object with all fields populated", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({
      type: "COURSE",
      format: "ONLINE",
      status: "OPEN",
      search: "robotica",
      campus: "ARAPIRACA",
      page: "3",
      limit: "15",
      orderBy: "created_at",
      order: "asc",
    });

    expect(repository.list).toHaveBeenCalledWith({
      type: "COURSE",
      format: "ONLINE",
      status: "OPEN",
      search: "robotica",
      campus: "ARAPIRACA",
      page: 3,
      limit: 15,
      orderBy: "createdAt",
      order: "asc",
    });
  });

  it("returns the result from the repository without changes", async () => {
    const repoResult = {
      activities: [
        { id: "act-1", title: "Oficina de Introdução à Programação" },
      ],
      total: 1,
    };
    const repository = mockRepository({
      list: vi.fn().mockResolvedValue(repoResult),
    });
    const service = new ActivityService({ activityRepository: repository });
    await expect(service.list({})).resolves.toBe(repoResult);
  });

  it("ignores the userId parameter (currently unused)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({}, "user-1");

    expect(repository.list).toHaveBeenCalledWith({
      type: undefined,
      format: undefined,
      status: undefined,
      search: undefined,
      campus: undefined,
      page: 1,
      limit: 20,
      orderBy: "createdAt",
      order: "desc",
    });
  });
});
