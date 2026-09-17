import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import type { NavigateFunction } from "react-router";

interface ApiErrorShape {
  status?: number;
  message?: string;
  errors?: Array<{ field?: string; path?: string; message?: string }>;
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Array<{ field?: string; path?: string; message?: string }>;
    };
  };
  data?: {
    message?: string;
    errors?: Array<{ field?: string; path?: string; message?: string }>;
  };
}

function translateSlotErrorMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  // "slots cannot be reduced below the current number of approved enrollments (X)."
  if (
    lowerMessage.includes("cannot be reduced") ||
    lowerMessage.includes("approved enrollments")
  ) {
    const countMatch = message.match(/\((\d+)\)/) || message.match(/\d+/);
    const count = countMatch ? countMatch[1] || countMatch[0] : null;

    return count
      ? `A quantidade de vagas não pode ser menor que o número atual de inscrições aprovadas (${count}).`
      : "A quantidade de vagas não pode ser menor que o número atual de inscrições aprovadas.";
  }

  // "The minimum number of slots allowed is X current subscribers."
  if (
    lowerMessage.includes("minimum number of slots") ||
    lowerMessage.includes("current subscribers")
  ) {
    const countMatch = message.match(/\d+/);
    const count = countMatch ? countMatch[0] : null;

    return count
      ? `O número mínimo de vagas permitido é ${count} inscritos atuais.`
      : "A quantidade de vagas não pode ser menor do que o número de inscritos atuais.";
  }

  return message;
}

export function handleActionApiErrors<T extends FieldValues>(
  error: ApiErrorShape,
  setError: UseFormSetError<T>,
  setGeneralError: (msg: string | null) => void,
  navigate: NavigateFunction
) {
  const status = error?.status ?? error?.response?.status;
  const message =
    error?.message ?? error?.response?.data?.message ?? error?.data?.message;
  const apiErrors =
    error?.errors ?? error?.response?.data?.errors ?? error?.data?.errors;

  switch (status) {
    case 400: {
      let assignedToField = false;

      // Trata erros de campos específicos vindos na lista apiErrors
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        apiErrors.forEach((err) => {
          const fieldName = err.field || err.path;
          if (fieldName && err.message) {
            const finalMessage =
              fieldName === "slots" || fieldName === "details.slots"
                ? translateSlotErrorMessage(err.message)
                : err.message;

            setError(fieldName as Path<T>, {
              type: "manual",
              message: finalMessage,
            });
            assignedToField = true;
          }
        });
      }

      // Trata mensagem de erro geral ou fallback
      if (message) {
        const lowerMessage = message.toLowerCase();

        const isSlotError = [
          "vaga",
          "slot",
          "inscrito",
          "subscriber",
          "enrollment",
          "enrolled",
          "minimum",
          "reduced",
        ].some((term) => lowerMessage.includes(term));

        if (isSlotError) {
          setError("slots" as Path<T>, {
            type: "manual",
            message: translateSlotErrorMessage(message),
          });
        } else if (!assignedToField) {
          setGeneralError(message);
        }
      }
      break;
    }

    case 401:
      navigate("/login");
      break;

    case 403:
      setGeneralError("Apenas o autor ou gestor pode editar esta ação.");
      break;

    case 404:
      setGeneralError("Ação não encontrada ou removida.");
      break;

    case 409:
      setGeneralError("Ações concluídas ou canceladas não podem ser editadas.");
      break;

    default:
      setGeneralError("Ocorreu um erro ao atualizar a ação. Tente novamente.");
      break;
  }
}