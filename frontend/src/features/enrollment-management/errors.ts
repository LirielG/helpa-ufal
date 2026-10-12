import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";

/**
 * Maps enrollment-list API errors to user-friendly messages in Portuguese.
 *
 * Returns null for 401 Unauthorized — the session middleware handles the
 * redirect and no error message should be displayed on the page.
 */
export function getEnrollmentsErrorMessage(error: ApiError): string | null {
  if (error.status === 401) return null;

  if (error.status === NETWORK_ERROR_STATUS)
    return "Falha de comunicação com o servidor. Tente novamente.";

  if (error.status === 403)
    return "Você não tem permissão para ver os inscritos desta ação.";

  if (error.status === 404)
    return "A ação não foi encontrada ou foi removida.";

  return "Erro ao carregar os inscritos. Tente novamente.";
}
