import {
  ApiError,
  CONNECTION_ERROR_MESSAGE,
  isConnectionFailure,
} from "@/services/apiError";

export interface ReportsListError {
  message: string;
  canRetry: boolean;
  isForbidden: boolean;
}

const GENERIC_LIST_ERROR_MESSAGE =
  "Não foi possível carregar as denúncias. Tente novamente.";

const GENERIC_RESOLUTION_ERROR_MESSAGE =
  "Não foi possível resolver a denúncia. Tente novamente.";

/**
 * Maps `GET /reports` errors to user-facing messages in Portuguese.
 *
 * Returns null for 401: the HTTP client already notifies the session handler,
 * which redirects to login without rendering an error on the screen.
 */
export function resolveReportsListError(
  error: unknown,
): ReportsListError | null {
  if (!(error instanceof ApiError)) {
    return {
      message: GENERIC_LIST_ERROR_MESSAGE,
      canRetry: true,
      isForbidden: false,
    };
  }

  if (error.status === 401) return null;

  if (isConnectionFailure(error)) {
    return {
      message: CONNECTION_ERROR_MESSAGE,
      canRetry: true,
      isForbidden: false,
    };
  }

  if (error.status === 403) {
    return {
      message: "Você não tem permissão para acessar a moderação de denúncias.",
      canRetry: false,
      isForbidden: true,
    };
  }

  if (error.status === 404) {
    return {
      message: "Denúncia não encontrada.",
      canRetry: false,
      isForbidden: false,
    };
  }

  return {
    message: GENERIC_LIST_ERROR_MESSAGE,
    canRetry: true,
    isForbidden: false,
  };
}

export type ReportResolutionError =
  | { kind: "sessionExpired" }
  | { kind: "notFound"; text: string }
  | { kind: "message"; text: string; canRetry: boolean };

/**
 * Decides how `ConfirmResolutionModal` reacts when
 * `PUT /reports/:reportId/resolution` fails.
 */
export function resolveReportResolutionError(
  error: unknown,
): ReportResolutionError {
  if (!(error instanceof ApiError)) {
    return {
      kind: "message",
      text: GENERIC_RESOLUTION_ERROR_MESSAGE,
      canRetry: true,
    };
  }

  if (error.status === 401) {
    return { kind: "sessionExpired" };
  }

  if (isConnectionFailure(error)) {
    return {
      kind: "message",
      text: CONNECTION_ERROR_MESSAGE,
      canRetry: true,
    };
  }

  if (error.status === 403) {
    return {
      kind: "message",
      text: "Você não tem permissão para resolver esta denúncia.",
      canRetry: false,
    };
  }

  if (error.status === 404) {
    return {
      kind: "notFound",
      text: "Denúncia não encontrada. Ela pode ter sido removida.",
    };
  }

  return {
    kind: "message",
    text: GENERIC_RESOLUTION_ERROR_MESSAGE,
    canRetry: true,
  };
}
