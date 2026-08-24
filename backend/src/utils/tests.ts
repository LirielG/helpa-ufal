import { describe, it, expect, vi } from "vitest";
import CustomError from "@/models/error/CustomError.js";

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