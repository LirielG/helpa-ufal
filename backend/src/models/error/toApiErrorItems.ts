import type { ErrorItemCode } from "@/models/error/ErrorCodes.js";
import type { ValidationErrorItem } from "@/models/error/ValidationError.js";

export type ApiErrorItem = {
  field: string;
  code: ErrorItemCode;
  message: string;
};

export function toApiErrorItems(
  items: readonly ValidationErrorItem[],
): ApiErrorItem[] {
  return items.map(({ field, code, message }) => ({
    field,
    code: code ?? "VALIDATION_ERROR",
    message,
  }));
}
