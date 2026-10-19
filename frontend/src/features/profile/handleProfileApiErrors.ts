import type { UseFormSetError } from "react-hook-form";
import { ApiError, NETWORK_ERROR_STATUS } from "../../services/apiError";
import { FULL_NAME_MAX_LENGTH } from "../../validators/limits";
import type { EditProfileFields } from "../../validators/profile";

const GENERIC_ERROR = "Não foi possível salvar o perfil. Tente novamente.";

// The API words its field errors in English, so each field gets a fixed pt-BR
// message instead of a translation of whatever the API said.
const FIELD_MESSAGES: Partial<Record<string, string>> = {
  fullName: `Informe um nome válido, com até ${FULL_NAME_MAX_LENGTH} caracteres.`,
  currentPassword: "Informe a senha atual.",
  newPassword: "A nova senha não atende aos requisitos.",
};

/**
 * Puts what the API rejected on the profile form's fields and returns the
 * message for the form-level alert, or null when there is nothing left to
 * show there. The form is never reset, so the user keeps what they typed.
 */
export function handleProfileApiErrors(
  error: unknown,
  setError: UseFormSetError<EditProfileFields>,
): string | null {
  if (!(error instanceof ApiError)) return GENERIC_ERROR;

  switch (error.status) {
    case 400: {
      let assigned = false;
      error.errors.forEach(({ field }) => {
        const message = FIELD_MESSAGES[field];
        if (message) {
          setError(field as keyof EditProfileFields, {
            type: "server",
            message,
          });
          assigned = true;
        }
      });
      return assigned ? null : GENERIC_ERROR;
    }
    // The HTTP client's session-expiry handler already sends the user to /login.
    case 401:
      return null;
    case 403:
      setError("currentPassword", {
        type: "server",
        message: "Senha atual incorreta.",
      });
      return null;
    case 422:
      setError("newPassword", {
        type: "server",
        message: "A nova senha deve ser diferente da atual.",
      });
      return null;
    case NETWORK_ERROR_STATUS:
      return "Falha de comunicação com o servidor. Tente novamente.";
    default:
      return GENERIC_ERROR;
  }
}
