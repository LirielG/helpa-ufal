import {
  ApiError,
  CONNECTION_ERROR_MESSAGE,
  isConnectionFailure,
} from "@/services/apiError";

/**
 * Maps report API errors to messages in Portuguese.
 *
 * Returns null for 401: the session handler already sends the user to the
 * login screen, so the modal has nothing to show.
 */
export function getReportErrorMessage(error: ApiError): string | null {
  if (isConnectionFailure(error)) return CONNECTION_ERROR_MESSAGE;

  switch (error.status) {
    case 401:
      return null;
    case 403:
      return "Você não pode denunciar uma ação que você criou.";
    case 404:
      return "A ação não foi encontrada. Ela pode ter sido removida.";
    case 409:
      return "Você já denunciou esta ação.";
    default:
      return "Não foi possível registrar a denúncia. Tente novamente.";
  }
}

/** Whether sending the same report again could succeed. */
export function isRetryableReportError(error: ApiError): boolean {
  return ![403, 404, 409].includes(error.status);
}
