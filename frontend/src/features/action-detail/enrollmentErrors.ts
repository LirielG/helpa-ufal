import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";

/**
 * Maps enrollment-list API errors to user-friendly messages in Portuguese.
 *
 * Returns null for 401 Unauthorized — the session middleware handles the
 * redirect and no error message should be displayed on the page.
 */
export function getEnrollmentsErrorMessage(error: ApiError): string | null {
  // Session expired: middleware will redirect, no message needed on page
  if (error.status === 401) return null;

  // Network error (fetch failed before receiving a response)
  if (error.status === NETWORK_ERROR_STATUS)
    return "Falha de comunicação com o servidor. Tente novamente.";

  // 403: Authenticated but not the creator / manager of this activity
  if (error.status === 403)
    return "Você não tem permissão para ver os inscritos desta ação.";

  // 404: Activity was removed or the id is wrong
  if (error.status === 404)
    return "A ação não foi encontrada ou foi removida.";

  // Unknown status: generic fallback
  return "Erro ao carregar os inscritos. Tente novamente.";
}
