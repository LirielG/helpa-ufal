import { describe, expect, it } from "vitest";
import CustomError from "@/models/error/CustomError.js";

describe("CustomError", () => {
  it("keeps the status and the message untouched", () => {
    const error = new CustomError(404, "Activity not found.");

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Activity not found.");
  });

  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "UNPROCESSABLE"],
    [500, "INTERNAL_ERROR"],
  ] as const)("derives the generic code of status %i: %s", (status, code) => {
    expect(new CustomError(status, "Any message.").code).toBe(code);
  });

  it("prefers an explicit code over the generic one", () => {
    const error = new CustomError(409, "User is already enrolled.", {
      code: "ALREADY_ENROLLED",
    });

    expect(error.code).toBe("ALREADY_ENROLLED");
    expect(error.statusCode).toBe(409);
  });

  it("derives the generic code when the options only carry details", () => {
    const error = new CustomError(409, "Conflict.", { details: { a: 1 } });

    expect(error.code).toBe("CONFLICT");
  });

  it("exposes the details it was given", () => {
    const error = new CustomError(409, "Conflict.", { details: { field: "x" } });

    expect(error.details).toEqual({ field: "x" });
  });

  it("has no details by default", () => {
    expect(new CustomError(404, "Not found.").details).toBeUndefined();
  });
});