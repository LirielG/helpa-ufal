import type { ValidationError } from "../validators";

/** `status` of an ApiError raised when the request never got a response. */
export const NETWORK_ERROR_STATUS = 0;

/** An `errors[]` item as received. The body is not validated, so `code` may be missing. */
export type ApiValidationError = ValidationError & { code?: string };

export type ApiErrorOptions = {
  code?: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiValidationError[];
  /** Stable identifier from the error body; what the screen picks its text by. */
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    errors: ApiValidationError[] = [],
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

export const CONNECTION_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Tente novamente.";

export function isConnectionFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === NETWORK_ERROR_STATUS ||
      (error.status >= 500 && error.status < 600))
  );
}
