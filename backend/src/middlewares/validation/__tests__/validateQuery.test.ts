// src/middlewares/validation/__tests__/validateQuery.test.ts
import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import ValidationError from "@/models/error/ValidationError.js";
import { validateQuery } from "../validateQuery.js";
import { ListParticipantsQuerySchema } from "@/schemas/enrollment/EnrollmentSchemas.js";
import { ListActivitiesQuerySchema } from "@/schemas/activity/ActivitySchemas.js";
import { ListSigaaActivitiesQuerySchema } from "@/schemas/sigaa/SigaaActivitySchemas.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";
import { ListReportedActivitiesQuerySchema } from "@/schemas/moderation/moderationSchemas.js";

// Contract: the middleware never responds by itself — it either forwards the
// parsed query through res.locals.validatedQuery or forwards one
// ValidationError through next(), straight to the ErrorHandler.

const middleware = validateQuery(
  ListParticipantsQuerySchema,
  INVALID_QUERY_MESSAGE,
);

function fakeRequest(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

function fakeResponse() {
  const res = {
    locals: {} as Record<string, unknown>,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { res: res as unknown as Response, locals: res.locals, spies: res };
}

type MiddlewareError = Error & {
  errors: { field: string; message: string }[];
};

function callMiddleware(query: Record<string, unknown>): {
  error: MiddlewareError | undefined;
  locals: Record<string, unknown>;
  next: ReturnType<typeof vi.fn>;
} {
  const req = fakeRequest(query);
  const { res, locals } = fakeResponse();
  const next = vi.fn() as unknown as NextFunction;

  middleware(req, res, next);

  const spy = next as unknown as ReturnType<typeof vi.fn>;
  return { error: spy.mock.calls[0]?.[0], locals, next: spy };
}

describe("validateQuery(ListParticipantsQuerySchema)", () => {
  // ---------- Happy path ----------

  it("applies the schema defaults when the query is empty", () => {
    const { error, locals, next } = callMiddleware({});

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // next() with no arguments
    expect(locals.validatedQuery).toEqual({ page: 1, limit: 20 });
  });

  it("forwards explicit values already transformed to numbers", () => {
    const { error, locals } = callMiddleware({ page: "2", limit: "25" });

    expect(error).toBeUndefined();
    const query = locals.validatedQuery as { page: number; limit: number };
    expect(query.page).toBe(2);
    expect(query.limit).toBe(25);
    expect(typeof query.page).toBe("number");
    expect(typeof query.limit).toBe("number");
  });

  it("accepts the upper boundary limit=100", () => {
    const { error, locals } = callMiddleware({ limit: "100" });

    expect(error).toBeUndefined();
    expect((locals.validatedQuery as { limit: number }).limit).toBe(100);
  });

  // ---------- 400 - one error item per field ----------

  it.each([
    ["page", "abc", "page must be a positive integer."],
    ["page", "0", "page must be a positive integer."],
    ["page", "-1", "page must be a positive integer."],
    ["page", "1.5", "page must be a positive integer."],
    ["page", "", "page must be a positive integer."],
    ["limit", "abc", "limit must be a positive integer."],
    ["limit", "0", "limit must be a positive integer."],
    ["limit", "", "limit must be a positive integer."],
  ] as const)(
    'rejects %s="%s" with a single-field ValidationError',
    (_field, value, message) => {
      const { error, next } = callMiddleware({ [_field]: value });

      expect(next).toHaveBeenCalledTimes(1);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe(INVALID_QUERY_MESSAGE);
      expect(error?.errors).toEqual([{ field: _field, message }]);
    },
  );

  it("rejects limit above the cap with the cap-specific message", () => {
    const { error } = callMiddleware({ limit: "101" });

    expect(error?.errors).toEqual([
      { field: "limit", message: "limit must be at most 100." },
    ]);
  });

  it("reports one error per field when several params are invalid", () => {
    // Contract says the body carries exactly one { field, message } per
    // offending param — never a pile of Zod internals for the same field.
    const { error } = callMiddleware({ page: "abc", limit: "0" });

    expect(error?.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
      { field: "limit", message: "limit must be a positive integer." },
    ]);
  });

  // ---------- Middleware mechanics ----------

  it("never leaks partial state: validatedQuery stays undefined on failure", () => {
    const { locals } = callMiddleware({ page: "abc" });

    expect(locals.validatedQuery).toBeUndefined();
  });

  it("never writes the response itself, in either path", () => {
    // Responding is the ErrorHandler's job; this middleware only calls next().
    for (const query of [{}, { page: "abc" }]) {
      const req = fakeRequest(query);
      const { res, spies } = fakeResponse();
      const next = vi.fn() as unknown as NextFunction;

      middleware(req, res, next);

      expect(spies.status).not.toHaveBeenCalled();
      expect(spies.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});

describe("validateQuery with a strict schema", () => {
  const strictMiddleware = validateQuery(
    ListReportedActivitiesQuerySchema,
    INVALID_QUERY_MESSAGE,
  );

  function callStrict(query: Record<string, unknown>) {
    const { res } = fakeResponse();
    const next = vi.fn();
    strictMiddleware(fakeRequest(query), res, next as unknown as NextFunction);
    return next.mock.calls[0]?.[0] as MiddlewareError | undefined;
  }

  it("reports each unknown parameter as its own UNKNOWN_PARAMETER item", () => {
    const error = callStrict({ resolved: "false", search: "x" });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.message).toBe(INVALID_QUERY_MESSAGE);
    expect(error?.errors).toEqual([
      {
        field: "resolved",
        code: "UNKNOWN_PARAMETER",
        message: "resolved is not a supported query parameter.",
      },
      {
        field: "search",
        code: "UNKNOWN_PARAMETER",
        message: "search is not a supported query parameter.",
      },
    ]);
  });

  it("reports unknown and invalid parameters together in one errors[]", () => {
    const error = callStrict({ page: "0", sort: "asc" });

    expect(error?.errors).toEqual(
      expect.arrayContaining([
        { field: "page", message: "page must be a positive integer." },
        {
          field: "sort",
          code: "UNKNOWN_PARAMETER",
          message: "sort is not a supported query parameter.",
        },
      ]),
    );
    expect(error?.errors).toHaveLength(2);
  });
});

describe.each([
  ["GET /activities", ListActivitiesQuerySchema],
  ["GET /sigaa-activities", ListSigaaActivitiesQuerySchema],
  ["GET /activities/:activityId/enrollments", ListParticipantsQuerySchema],
] as const)("shared pagination schema of %s", (_route, schema) => {
  function call(query: Record<string, unknown>) {
    const { res, locals } = fakeResponse();
    const next = vi.fn();
    validateQuery(schema, INVALID_QUERY_MESSAGE)(
      fakeRequest(query),
      res,
      next as unknown as NextFunction,
    );
    return {
      error: next.mock.calls[0]?.[0] as MiddlewareError | undefined,
      locals,
    };
  }

  it("applies the defaults when page and limit are absent", () => {
    expect(call({}).locals.validatedQuery).toEqual({ page: 1, limit: 20 });
  });

  it("accepts limit=100 and rejects limit=101", () => {
    expect(call({ limit: "100" }).locals.validatedQuery).toEqual({
      page: 1,
      limit: 100,
    });
    expect(call({ limit: "101" }).error?.errors).toEqual([
      { field: "limit", message: "limit must be at most 100." },
    ]);
  });

  it.each(["10.9", "20abc", "1e2", "-5", "+5", " 5", "02", "0", ""])(
    "rejects page and limit %j with one item per parameter",
    (value) => {
      expect(call({ page: value, limit: value }).error?.errors).toEqual([
        { field: "page", message: "page must be a positive integer." },
        { field: "limit", message: "limit must be a positive integer." },
      ]);
    },
  );

  it("rejects a repeated limit (?limit=1&limit=2 arrives as an array)", () => {
    const { error } = call({ limit: ["1", "2"] });

    expect(error?.errors).toHaveLength(1);
    expect(error?.errors[0].field).toBe("limit");
  });

  it("does not reject unknown parameters", () => {
    expect(call({ foo: "bar" }).error).toBeUndefined();
  });
});

describe.each([
  ["GET /activities", ListActivitiesQuerySchema],
  ["GET /sigaa-activities", ListSigaaActivitiesQuerySchema],
] as const)("filters of %s", (_route, schema) => {
  it("reach the controller untouched", () => {
    const { res, locals } = fakeResponse();

    validateQuery(schema, INVALID_QUERY_MESSAGE)(
      fakeRequest({ type: "", search: " x " }),
      res,
      vi.fn() as unknown as NextFunction,
    );

    expect(locals.validatedQuery).toEqual({
      page: 1,
      limit: 20,
      type: "",
      search: " x ",
    });
  });
});
