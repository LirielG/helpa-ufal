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

  it("has no details by default", () => {
    expect(new ValidationError([]).details).toBeUndefined();
  });
});