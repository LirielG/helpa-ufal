export const GENERIC_ERROR_CODES = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
} as const;

export type ErrorStatus = keyof typeof GENERIC_ERROR_CODES;
export type GenericErrorCode = (typeof GENERIC_ERROR_CODES)[ErrorStatus];

export type SpecificErrorCode =
  | "SESSION_INVALID"
  | "ACTIVITY_NOT_FOUND"
  | "ENROLLMENT_NOT_FOUND"
  | "ACTIVITY_NOT_OPEN_FOR_ENROLLMENT"
  | "ALREADY_ENROLLED"
  | "NO_AVAILABLE_SLOTS"
  | "ACTIVITY_NOT_COMPLETED"
  | "ENROLLMENT_NOT_APPROVED"
  | "ALREADY_IN_USE";

export type ErrorCode = GenericErrorCode | SpecificErrorCode;

export type ErrorItemCode =
  | "VALIDATION_ERROR"
  | "UNKNOWN_PARAMETER"
  | "INVALID_UUID"
  | "INVALID_DATETIME"
  | "BELOW_APPROVED_ENROLLMENTS";

export type ErrorDetails = Record<string, unknown>;
