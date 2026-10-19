import type { ValidationError } from "../validators";

/** `status` of an ApiError raised when the request never got a response. */
export const NETWORK_ERROR_STATUS = 0;

export type ApiErrorOptions = {
  code?: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ValidationError[];
  /** Stable identifier from the error body; what the screen picks its text by. */
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    errors: ValidationError[] = [],
    { code, details }: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
    this.details = details;
  }
}
