import { describe, expect, it } from "vitest";
import ValidationError from "@/models/error/ValidationError.js";
import CustomError from "@/models/error/CustomError.js";
import type { ValidationErrorItem } from "@/models/error/ValidationError.js";

it("keeps an explicit item code", () => {
  const items: ValidationErrorItem[] = [
    { field: "slots", code: "BELOW_APPROVED_ENROLLMENTS", message: "Bad." },
  ];
  expect(new ValidationError(items).errors).toEqual(items);
});

describe("ValidationError", () => {
  it("is a 400 CustomError with the VALIDATION_ERROR code", () => {
    const error = new ValidationError([{ field: "slots", message: "Bad." }]);

    expect(error).toBeInstanceOf(CustomError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Validation error.");
  });

  it("accepts a custom message", () => {
    const error = new ValidationError([], "Invalid query parameters.");

    expect(error.message).toBe("Invalid query parameters.");
  });

  it("keeps the items exactly as given, without filling in a code", () => {
    const items = [{ field: "slots", message: "Bad." }];

    expect(new ValidationError(items).errors).toEqual(items);
  });

  it("keeps an explicit item code", () => {
    const items: ValidationErrorItem[] = [
      { field: "slots", code: "BELOW_APPROVED_ENROLLMENTS", message: "Bad." },
    ];
    expect(new ValidationError(items).errors).toEqual(items);
  });

  it("carries the details it was given", () => {
    const error = new ValidationError(
      [{ field: "slots", message: "Bad." }],
      undefined,
      { details: { approvedEnrollments: 12 } },
    );

    expect(error.message).toBe("Validation error.");
    expect(error.details).toEqual({ approvedEnrollments: 12 });
  });

  it("accepts a 422 status and a custom code", () => {
    const error = new ValidationError(
      [{ field: "slots", message: "Bad." }],
      undefined,
      { status: 422, code: "SLOTS_BELOW_APPROVED_ENROLLMENTS" },
    );

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("SLOTS_BELOW_APPROVED_ENROLLMENTS");
  });

  it("keeps 400 and VALIDATION_ERROR when no options are given", () => {
    const error = new ValidationError([{ field: "slots", message: "Bad." }]);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("has no details by default", () => {
    expect(new ValidationError([]).details).toBeUndefined();
  });
});
