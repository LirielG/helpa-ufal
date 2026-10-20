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

  if (error.status === 404) return "A ação não foi encontrada ou foi removida.";

  return "Erro ao carregar os inscritos. Tente novamente.";
}

export type AttendanceErrorResolution =
  | { kind: "sessionExpired" }
  /** Belongs next to the hours field. */
  | { kind: "field"; text: string }
  /** The list no longer matches the server; the caller should reload it. */
  | { kind: "stale"; text: string }
  | { kind: "message"; text: string };

const GENERIC_ATTENDANCE_MESSAGE =
  "Não foi possível homologar a presença. Tente novamente.";

/**
 * Decides what the screen does when `PUT /enrollments/:id/attendance` fails.
 *
 * The two 409s differ only by `message` until the API exposes error codes;
 * keep that comparison here so the switch to codes stays local.
 */
export function resolveAttendanceError(
  error: unknown,
): AttendanceErrorResolution {
  if (!(error instanceof ApiError)) {
    return { kind: "message", text: GENERIC_ATTENDANCE_MESSAGE };
  }

  // The HTTP client already notified the session handler.
  if (error.status === 401) return { kind: "sessionExpired" };

  if (error.status === NETWORK_ERROR_STATUS) {
    return {
      kind: "message",
      text: "Falha de comunicação com o servidor. Tente novamente.",
    };
  }

  if (error.status === 403) {
    return {
      kind: "message",
      text: "Você não tem permissão para homologar esta presença.",
    };
  }

  if (error.status === 404) {
    return { kind: "stale", text: "Inscrição não encontrada." };
  }

  if (error.status === 409) {
    if (error.code === "ENROLLMENT_NOT_APPROVED") {
      return {
        kind: "stale",
        text: "Esta inscrição não está mais aprovada, então a presença não pode ser homologada.",
      };
    }

    return {
      kind: "stale",
      text: "Esta ação não está mais concluída, então a presença não pode ser homologada.",
    };
  }

  if (error.status === 422) {
    return {
      kind: "field",
      text: "Informe um número inteiro de horas entre 1 e a carga horária da ação.",
    };
  }

  if (error.status === 400) {
    // Hours sent with an absence, or missing with a presence: the form keeps
    // that pair consistent, so this only shows up if the two drift apart.
    if (error.errors.some((issue) => issue.field === "workloadHours")) {
      return {
        kind: "field",
        text: "Horas incompatíveis com a presença informada.",
      };
    }

    return {
      kind: "message",
      text: "Dados inválidos. Recarregue a página e tente novamente.",
    };
  }

  return { kind: "message", text: GENERIC_ATTENDANCE_MESSAGE };
}
