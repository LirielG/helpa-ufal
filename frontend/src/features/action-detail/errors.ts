import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";

/**
 * Maps enrollment API errors to user-friendly messages in Portuguese.
 *
 * Returns null for 401 Unauthorized — the session middleware handles the redirect
 * and no error message should be displayed in the modal.
 */
export function getEnrollmentErrorMessage(error: ApiError): string | null {
  // Session expired: middleware will redirect, no message needed in modal
  if (error.status === 401) {
    return null;
  }

  // Network error (fetch failed)
  if (error.status === NETWORK_ERROR_STATUS) {
    return "Falha de comunicação com o servidor. Tente novamente.";
  }

  // 404: Activity not found
  if (error.status === 404) {
    return "A ação não foi encontrada. Ela pode ter sido removida.";
  }

  // 400: Validation error (shouldn't happen from the UI, but handle gracefully)
  if (error.status === 400) {
    return "Dados inválidos. Tente recarregar a página e tente novamente.";
  }

  // 409: Enrollment conflict — differentiate by message
  if (error.status === 409) {
    const message = error.message || "";

    if (message.includes("already enrolled")) {
      return "Você já está inscrito nesta ação.";
    }

    if (message.includes("not open for enrollment")) {
      return "As inscrições para esta ação não estão abertas.";
    }

    if (message.includes("No available slots")) {
      return "Esta ação não tem mais vagas disponíveis.";
    }

    // Generic 409 fallback (shouldn't happen, but be safe)
    return "Não foi possível concluir a inscrição. Tente novamente.";
  }

  // Unknown status: generic error
  return "Erro ao realizar inscrição. Tente novamente.";
}

export type CancellationErrorResolution =
  | { kind: "alreadyCancelled" }
  | { kind: "activityRemoved" }
  | { kind: "sessionExpired" }
  | { kind: "message"; text: string };

const GENERIC_CANCELLATION_MESSAGE =
  "Não foi possível cancelar a inscrição. Tente novamente.";

/**
 * Decides what the screen does when `DELETE /activities/:id/enroll` fails.
 *
 * The two 404s differ only by `message` until the API exposes error codes;
 * keep that comparison here so the switch to codes stays local.
 */
export function resolveCancellationError(
  error: unknown,
): CancellationErrorResolution {
  if (!(error instanceof ApiError)) {
    return { kind: "message", text: GENERIC_CANCELLATION_MESSAGE };
  }

  // The HTTP client already notified the session handler.
  if (error.status === 401) {
    return { kind: "sessionExpired" };
  }

  if (error.status === NETWORK_ERROR_STATUS) {
    return {
      kind: "message",
      text: "Falha de comunicação com o servidor. Tente novamente.",
    };
  }

  if (error.status === 404) {
    // A concurrent cancellation already won: the goal state was reached.
    if (error.message === "Enrollment not found.") {
      return { kind: "alreadyCancelled" };
    }

    if (error.message === "Activity not found.") {
      return { kind: "activityRemoved" };
    }
  }

  if (error.status === 409) {
    return {
      kind: "message",
      text: "Esta ação não está mais aberta, não é possível cancelar a inscrição.",
    };
  }

  return { kind: "message", text: GENERIC_CANCELLATION_MESSAGE };
}
