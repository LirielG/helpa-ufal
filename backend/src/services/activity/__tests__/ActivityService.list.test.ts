import { describe, it, expect, vi } from "vitest";
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
    // Teto alinhado ao contrato Bruno nesta branch (era 50) — decisão D1 da #92.
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

  it("silently truncates a non-integer limit ('10.9' becomes 10)", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ limit: "10.9" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
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

  // ---------- Filtros ----------

  it("rejects invalid type with an error in the 'tipo' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ type: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "tipo",
        message:
          "tipo must be one of the following: EXTENSION, COURSE, EVENT, LECTURE, OTHER.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("rejects invalid type with an error in the 'tipo' field", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    const error = await captureValidationError(
      service.list({ format: "INVALIDO" }),
    );

    expect(error.errors).toEqual([
      {
        field: "formato",
        message: "formato must be one of the following: IN_PERSON, ONLINE, HYBRID.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

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
        field: "tipo",
        message:
          "tipo must be one of the following: EXTENSION, COURSE, EVENT, LECTURE, OTHER.",
      },
      {
        field: "status",
        message:
          "status must be one of the following: OPEN, IN_PROGRESS, COMPLETED, CANCELLED.",
      },
    ]);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("treats an empty type ('') as missing and passes it through as-is", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ type: "" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: "" }),
    );
  });

  // ---------- Precedência: paginação antes dos filtros ----------

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

  // ---------- Repasse ao repositório ----------

  it("applies order: 'desc' by default", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({});

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ order: "desc" }),
    );
  });

  it("maps orderBy: 'created_at' to 'createdAt'", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "created_at" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: "createdAt" }),
    );
  });

  it("maps orderBy: 'start_date' to 'createdAt' (current faulty behavior)", async () => {
    // TODO(#147): validation accepts "start_date", but the mapping compares
    // it against "data_inicio" — sorting by start date never happens. 
    // Once #147 is resolved, the expected value will become "startDate"
    // and this test should FAIL intentionally, signaling the fix.
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ orderBy: "start_date" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: "createdAt" }),
    );
  });

  it("passes search and campus to the repository without validation", async () => {
    const repository = mockRepository();
    const service = new ActivityService({ activityRepository: repository });

    await service.list({ search: "  robótica  ", campus: "NAO_E_UM_CAMPUS" });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "  robótica  ",
        campus: "NAO_E_UM_CAMPUS",
      }),
    );
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
      activities: [{ id: "act-1", title: "Oficina de Introdução à Programação" }],
      total: 1,
    };
    const repository = mockRepository({
      list: vi.fn().mockResolvedValue(repoResult),
    });
    const service = new ActivityService({ activityRepository: repository });
    await expect(service.list({})).resolves.toBe(repoResult);
  });

  it("ignores the usuarioId parameter (currently unused)", async () => {
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
