import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import ValidationError from "@/models/error/ValidationError.js";
import {
  ActivityPathParamsSchema,
  EnrollmentPathParamsSchema,
} from "@/schemas/common/PathParamsSchemas.js";
import { ListReportsQuerySchema } from "@/schemas/activityReport/activityReportSchemas.js";
import { ListParticipantsQuerySchema } from "@/schemas/enrollment/EnrollmentSchemas.js";
import { UpdateActivitySchema } from "@/schemas/activity/ActivitySchemas.js";
import { validateParams } from "../validateParams.js";

describe("validateParams", () => {
  it("forwards a malformed path id as INVALID_UUID without publishing parsed data", () => {
    const req = { params: { activityId: "not-a-uuid" } } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Validation error.");
    expect(error.errors).toEqual([
      {
        field: "activityId",
        code: "INVALID_UUID",
        message: "activityId must be a valid UUID.",
      },
    ]);
    expect(res.locals).toEqual({});
  });

  it("collects path, query and body errors together and leaves locals untouched", () => {
    const req = {
      params: { activityId: "not-a-uuid" },
      query: { page: "0" },
      body: { address: { zipCode: "invalid" } },
    } as unknown as Request;
    const res = { locals: { existing: true } } as unknown as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema, {
      query: ListParticipantsQuerySchema,
      body: UpdateActivitySchema,
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as ValidationError;
    expect(error.errors).toEqual(
      expect.arrayContaining([
        {
          field: "activityId",
          code: "INVALID_UUID",
          message: "activityId must be a valid UUID.",
        },
        { field: "page", message: "page must be a positive integer." },
        {
          field: "address.zipCode",
          message: "zipCode must contain exactly 8 digits.",
        },
      ]),
    );
    expect(res.locals).toEqual({ existing: true });
  });

  it.each([
    ["00000000-0000-4000-8000-000000000000", true],
    ["FFFFFFFF-FFFF-4FFF-BFFF-FFFFFFFFFFFF", true],
    ["a1b2c3d4-1000-1000-8000-000000000000", false],
    ["00000000-0000-4000-7000-000000000000", false],
    [undefined, false],
    [["00000000-0000-4000-8000-000000000000"], false],
  ])("validates UUID v4 %j (accepted: %s)", (activityId, accepted) => {
    const req = { params: { activityId } } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    if (accepted) {
      expect(next).toHaveBeenCalledWith();
      expect(res.locals.validatedParams).toEqual({ activityId });
    } else {
      expect(next.mock.calls[0]?.[0].errors).toEqual([
        {
          field: "activityId",
          code: "INVALID_UUID",
          message: "activityId must be a valid UUID.",
        },
      ]);
      expect(res.locals).toEqual({});
    }
  });

  it("publishes transformed params, defaulted query and transformed body together", () => {
    const activityId = "00000000-0000-4000-8000-000000000000";
    const req = {
      params: { activityId },
      query: { page: "2" },
      body: { startDate: "2026-12-01T10:00:00Z", title: "Updated" },
    } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema, {
      query: ListParticipantsQuerySchema,
      body: UpdateActivitySchema,
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.locals).toEqual({
      validatedParams: { activityId },
      validatedQuery: { page: 2, limit: 10 },
      validatedBody: {
        startDate: new Date("2026-12-01T10:00:00Z"),
        title: "Updated",
      },
    });
  });

  it("reports every invalid path parameter", () => {
    const schema = ActivityPathParamsSchema.extend(
      EnrollmentPathParamsSchema.shape,
    );
    const req = {
      params: { activityId: "bad", enrollmentId: "bad" },
    } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0].errors).toEqual([
      {
        field: "activityId",
        code: "INVALID_UUID",
        message: "activityId must be a valid UUID.",
      },
      {
        field: "enrollmentId",
        code: "INVALID_UUID",
        message: "enrollmentId must be a valid UUID.",
      },
    ]);
    expect(res.locals).toEqual({});
  });

  it("preserves query errors and unknown parameter items without publishing valid params", () => {
    const req = {
      params: { activityId: "00000000-0000-4000-8000-000000000000" },
      query: { page: "0", sort: "asc", search: "x" },
      body: { title: "Updated" },
    } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema, {
      query: ListReportsQuerySchema,
      body: UpdateActivitySchema,
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as ValidationError;
    expect(error.message).toBe("Invalid query parameters.");
    expect(error.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
      {
        field: "sort",
        code: "UNKNOWN_PARAMETER",
        message: "sort is not a supported query parameter.",
      },
      {
        field: "search",
        code: "UNKNOWN_PARAMETER",
        message: "search is not a supported query parameter.",
      },
    ]);
    expect(res.locals).toEqual({});
  });

  it("preserves body errors without publishing valid params or query", () => {
    const req = {
      params: { activityId: "00000000-0000-4000-8000-000000000000" },
      query: {},
      body: {},
    } as unknown as Request;
    const res = { locals: {} } as Response;
    const next = vi.fn();

    validateParams(ActivityPathParamsSchema, {
      query: ListParticipantsQuerySchema,
      body: UpdateActivitySchema,
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as ValidationError;
    expect(error.message).toBe("Validation error.");
    expect(error.errors).toEqual([
      {
        field: "",
        message: "Body cannot be empty. At least one field must be provided.",
      },
    ]);
    expect(res.locals).toEqual({});
  });
});
