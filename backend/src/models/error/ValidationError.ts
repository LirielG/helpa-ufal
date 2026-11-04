import CustomError from "@/models/error/CustomError.js";
import type {
  ErrorCode,
  ErrorDetails,
  ErrorItemCode,
} from "@/models/error/ErrorCodes.js";

// Input shape: `code` stays optional so existing call sites do not change.
// The default is applied when the item is serialized (toApiErrorItems).
export type ValidationErrorItem = {
  field: string;
  code?: ErrorItemCode;
  message: string;
};

export type ValidationErrorOptions = {
  details?: ErrorDetails;
  status?: 400 | 422;
  code?: ErrorCode;
};

class ValidationError extends CustomError {
  private _errors: ValidationErrorItem[];

  constructor(
    errors: ValidationErrorItem[],
    message = "Validation error.",
    options: ValidationErrorOptions = {},
  ) {
    super(options.status ?? 400, message, {
      code: options.code ?? "VALIDATION_ERROR",
      details: options.details,
    });
    this._errors = errors;
  }

  public get errors(): ValidationErrorItem[] {
    return this._errors;
  }
}

export default ValidationError;
