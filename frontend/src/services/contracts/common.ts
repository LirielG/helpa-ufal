/**
 * Wire types shared by every feature's contracts.
 *
 * Source of truth is `backend/docs/api-conventions.md` (§3 pagination, §4 errors)
 * read alongside the Bruno examples under `backend/docs/bruno/`. Features never
 * redeclare the wire format: their own screen model converts in the feature's
 * `services.ts`.
 */

/**
 * Envelope of a paginated route (§3).
 *
 * The array is always `items` — never the resource name, never `meta`. `page`
 * and `limit` echo the effective values; `totalPages` is `max(1, ceil(total/limit))`.
 * Route-specific aggregates (e.g. `totalPresent`) sit at the top level next to
 * `total`.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Error body (§4).
 *
 * `message` is English text meant for debugging only; the frontend decides from
 * `code`/`field`. `stack` is only present with `NODE_ENV=development`.
 *
 * NOTE: the backend does not emit `code` yet (`CustomError`/`ValidationError`
 * carry only `status` + `message`, and `ErrorHandler` returns no `code`). The
 * vocabulary below comes from §4/§5 of the conventions, not from the backend.
 */
export interface ApiErrorBody {
  status: number;
  code: ApiErrorCode;
  message: string;
  errors?: ApiErrorItem[];
  details?: Record<string, unknown>;
  stack?: string; // only in development
}

export interface ApiErrorItem {
  field: string;
  code: ApiErrorItemCode;
  message: string;
}

/** §4 "codes genéricos" + §5 `SESSION_INVALID`. */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL_ERROR"
  | "SESSION_INVALID";

/** §4 "codes de item de `errors[]` já definidos". */
export type ApiErrorItemCode =
  | "INVALID_UUID"
  | "UNKNOWN_PARAMETER"
  | "INVALID_DATETIME";
