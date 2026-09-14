import { expect } from "vitest";
import CustomError from "@/models/error/CustomError.js";
import ValidationError, {
  type ValidationErrorItem,
} from "@/models/error/ValidationError.js";

export async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  message?: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
    expect((error as CustomError & { statusCode: number }).statusCode).toBe(status);
    if (message) expect((error as CustomError).message).toBe(message);
    return;
  }
  throw new Error(`Expected a CustomError with status ${status}, but nothing was thrown.`);
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject, but it resolved.");
}

/** Asserts a ValidationError with status 400 and the exact `errors` items, in order. */
export async function expectValidationError(
  promise: Promise<unknown>,
  expectedErrors: ValidationErrorItem[],
): Promise<void> {
  const error = await catchError(promise);
  expect(error).toBeInstanceOf(ValidationError);
  expect((error as ValidationError).statusCode).toBe(400);
  expect((error as ValidationError).message).toBe("Validation error.");
  expect((error as ValidationError).errors).toEqual(expectedErrors);
}

/** Asserts a CustomError with the given status that is not a ValidationError. */
export async function expectCustomError(
  promise: Promise<unknown>,
  status: number,
  message?: string,
): Promise<void> {
  const error = await catchError(promise);
  expect(error).toBeInstanceOf(CustomError);
  expect(error).not.toBeInstanceOf(ValidationError);
  expect((error as CustomError).statusCode).toBe(status);
  if (message) expect((error as CustomError).message).toBe(message);
}
