// src/middlewares/validation/__tests__/validateQuery.test.ts
import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import ValidationError from "@/models/error/ValidationError.js";
import { validateQuery } from "../validateQuery.js";
import {
  INVALID_QUERY_MESSAGE,
  ListParticipantsQuerySchema,
} from "@/schemas/enrollment/EnrollmentSchemas.js";
import { ListReportsQuerySchema } from "@/schemas/activityReport/activityReportSchemas.js";

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
    expect(locals.validatedQuery).toEqual({ page: 1, limit: 10 });
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

  it("accepts the upper boundary limit=50", () => {
    const { error, locals } = callMiddleware({ limit: "50" });

    expect(error).toBeUndefined();
    expect((locals.validatedQuery as { limit: number }).limit).toBe(50);
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
    const { error } = callMiddleware({ limit: "51" });

    expect(error?.errors).toEqual([
      { field: "limit", message: "limit must be at most 50." },
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
    ListReportsQuerySchema,
    INVALID_QUERY_MESSAGE,
  );

  function callStrict(query: Record<string, unknown>) {
    const { res } = fakeResponse();
    const next = vi.fn();
    strictMiddleware(fakeRequest(query), res, next as unknown as NextFunction);
    return next.mock.calls[0]?.[0] as MiddlewareError | undefined;
  }

  it("reports each unknown parameter as its own UNKNOWN_PARAMETER item", () => {
    const error = callStrict({ status: "OPEN", search: "x" });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.message).toBe(INVALID_QUERY_MESSAGE);
    expect(error?.errors).toEqual([
      {
        field: "status",
        code: "UNKNOWN_PARAMETER",
        message: "status is not a supported query parameter.",
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
