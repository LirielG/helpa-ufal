import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import errorHandler from "@/controllers/error/ErrorHandler.js";

const envMock = vi.hoisted(() => ({ NODE_ENV: "test" as string }));
vi.mock("@/config/env.js", () => ({ env: envMock }));

const req = {} as Request;

function aResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
type FakeResponse = ReturnType<typeof aResponse>;
const asResponse = (res: FakeResponse) => res as unknown as Response;
// What actually goes over the wire: undefined properties disappear.
const sent = (res: FakeResponse) =>
  JSON.parse(JSON.stringify(res.json.mock.calls.at(-1)?.[0]));

function aZodError() {
  const result = z
    .object({
      slots: z.number().min(1),
      address: z.object({ zipCode: z.string() }),
    })
    .safeParse({ slots: -5, address: { zipCode: 1 } });
  if (result.success) throw new Error("Expected the parse to fail.");
  return result.error;
}

function p2002(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta,
  });
}

afterEach(() => {
  envMock.NODE_ENV = "test";
});

describe("ErrorHandler.zodErrorHandler", () => {
  it("passes other errors along", () => {
    const next = vi.fn();
    const error = new Error("boom");

    errorHandler.zodErrorHandler(
      error,
      req,
      asResponse(aResponse()),
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(error);
  });

  it("answers 400 VALIDATION_ERROR with a code on every item", () => {
    const res = aResponse();

    errorHandler.zodErrorHandler(aZodError(), req, asResponse(res), vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sent(res)).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation error.",
      errors: [
        {
          field: "slots",
          code: "VALIDATION_ERROR",
          message: expect.any(String),
        },
        {
          field: "address.zipCode",
          code: "VALIDATION_ERROR",
          message: expect.any(String),
        },
      ],
    });
  });
});

describe("ErrorHandler.validationErrorHandler", () => {
  it("passes other errors along", () => {
    const next = vi.fn();
    const error = new CustomError(404, "Not found.");

    errorHandler.validationErrorHandler(
      error,
      req,
      asResponse(aResponse()),
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(error);
  });

  it("defaults the item code and keeps explicit ones", () => {
    const res = aResponse();
    const error = new ValidationError(
      [
        { field: "page", message: "page must be a positive integer." },
        {
          field: "foo",
          code: "UNKNOWN_PARAMETER",
          message: "foo is not a supported query parameter.",
        },
      ],
      "Invalid query parameters.",
    );

    errorHandler.validationErrorHandler(error, req, asResponse(res), vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sent(res)).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid query parameters.",
      errors: [
        {
          field: "page",
          code: "VALIDATION_ERROR",
          message: "page must be a positive integer.",
        },
        {
          field: "foo",
          code: "UNKNOWN_PARAMETER",
          message: "foo is not a supported query parameter.",
        },
      ],
    });
  });

  it("writes the details when present", () => {
    const res = aResponse();
    const error = new ValidationError(
      [{ field: "slots", code: "BELOW_APPROVED_ENROLLMENTS", message: "Bad." }],
      undefined,
      { details: { approvedEnrollments: 12 } },
    );

    errorHandler.validationErrorHandler(error, req, asResponse(res), vi.fn());

    expect(sent(res)).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation error.",
      errors: [
        { field: "slots", code: "BELOW_APPROVED_ENROLLMENTS", message: "Bad." },
      ],
      details: { approvedEnrollments: 12 },
    });
  });
});

describe("ErrorHandler.prismaErrorHandler", () => {
  it("passes non-P2002 errors along", () => {
    const next = vi.fn();
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "test",
    });

    errorHandler.prismaErrorHandler(
      error,
      req,
      asResponse(aResponse()),
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(error);
  });

  it.each([
    ["email", "Email already in use."],
    ["registrationCode", "Registration code already in use."],
    ["cndb", "CNDB already in use."],
  ])("answers ALREADY_IN_USE with the field for %s", (field, message) => {
    const res = aResponse();

    errorHandler.prismaErrorHandler(
      p2002({ target: [field] }),
      req,
      asResponse(res),
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(sent(res)).toEqual({
      status: 409,
      code: "ALREADY_IN_USE",
      message,
      details: { field },
    });
  });

  it("reads the field from the driver adapter error shape too", () => {
    const res = aResponse();
    const error = p2002({
      driverAdapterError: { cause: { constraint: { fields: ['"email"'] } } },
    });

    errorHandler.prismaErrorHandler(error, req, asResponse(res), vi.fn());

    expect(sent(res)).toEqual({
      status: 409,
      code: "ALREADY_IN_USE",
      message: "Email already in use.",
      details: { field: "email" },
    });
  });

  it("answers ALREADY_IN_USE without details, nor the column name, for a field outside the whitelist", () => {
    const res = aResponse();

    errorHandler.prismaErrorHandler(
      p2002({ target: ["internal_secret_column"] }),
      req,
      asResponse(res),
      vi.fn(),
    );

    expect(sent(res)).toEqual({
      status: 409,
      code: "ALREADY_IN_USE",
      message: "This value is already in use.",
    });
    expect(JSON.stringify(sent(res))).not.toContain("internal_secret_column");
  });
});

describe("ErrorHandler.defaultHandler", () => {
  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "UNPROCESSABLE"],
    [500, "INTERNAL_ERROR"],
  ] as const)("answers CustomError(%i) with the generic %s", (status, code) => {
    const res = aResponse();

    errorHandler.defaultHandler(
      new CustomError(status, "Some message."),
      req,
      asResponse(res),
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(status);
    expect(sent(res)).toEqual({ status, code, message: "Some message." });
  });

  it("writes the specific code and the details of a CustomError", () => {
    const res = aResponse();
    const error = new CustomError(
      409,
      "No available slots for this activity.",
      {
        code: "NO_AVAILABLE_SLOTS",
        details: { slots: 30 },
      },
    );

    errorHandler.defaultHandler(error, req, asResponse(res), vi.fn());

    expect(sent(res)).toEqual({
      status: 409,
      code: "NO_AVAILABLE_SLOTS",
      message: "No available slots for this activity.",
      details: { slots: 30 },
    });
  });

  it("answers an unknown error with 500 INTERNAL_ERROR and no internal detail", () => {
    const res = aResponse();

    errorHandler.defaultHandler(
      new Error("secret internals"),
      req,
      asResponse(res),
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(sent(res)).toEqual({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
    });
  });

  it("adds the stack only in development", () => {
    envMock.NODE_ENV = "development";
    const res = aResponse();

    errorHandler.defaultHandler(
      new Error("boom"),
      req,
      asResponse(res),
      vi.fn(),
    );

    expect(sent(res)).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      stack: expect.any(String),
    });
  });
});
