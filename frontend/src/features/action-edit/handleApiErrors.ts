import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { NavigateFunction } from "react-router";
import { ApiError, NETWORK_ERROR_STATUS } from "../../services/apiError";

const FIELD_MESSAGES: Record<string, string> = {
  title: "Informe um título válido.",
  description: "Informe uma descrição válida.",
  type: "Selecione um tipo de ação válido.",
  campus: "Selecione um campus válido.",
  area: "Informe uma área de atuação válida.",
  format: "Selecione um formato de ação válido.",
  slots: "Informe uma quantidade de vagas válida.",
  workloadHours: "Informe uma carga horária válida.",
  startDate: "A data de início deve ser futura e anterior à de encerramento.",
  endDate: "A data de encerramento deve ser posterior à de início.",
  url: "Informe um link válido. Ele é obrigatório em ações on-line e híbridas.",
  "address.addressLine": "Informe o logradouro.",
  "address.district": "Informe o bairro.",
  "address.zipCode": "O CEP deve ter 8 dígitos.",
  "address.city": "Informe a cidade.",
  "address.state": "Informe uma UF válida (ex.: AL).",
};

const FIELD_ALIASES: Record<string, string> = {
  address: "address.addressLine",
};

const APPROVED_ENROLLMENTS_PATTERN = /approved enrollments \((\d+)\)/i;

function translateSlotsMessage(apiMessage: string): string {
  const match = apiMessage.match(APPROVED_ENROLLMENTS_PATTERN);
  return match
    ? `A quantidade de vagas não pode ser menor que o número atual de inscrições aprovadas (${match[1]}).`
    : FIELD_MESSAGES.slots;
}

function applyValidationErrors<T extends FieldValues>(
  errors: Array<{ field: string; message: string }>,
  setError: UseFormSetError<T>
): boolean {
  let assigned = false;
  errors.forEach(({ field, message }) => {
    const target = FIELD_ALIASES[field] ?? field;
    const translated =
      target === "slots" ? translateSlotsMessage(message) : FIELD_MESSAGES[target];

    if (translated) {
      setError(target as Path<T>, { type: "server", message: translated });
      assigned = true;
    }
  });
  return assigned;
}

export function handleActionApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  setGeneralError: (message: string | null) => void,
  navigate: NavigateFunction,
): void {
  const GENERIC_ERROR = "Ocorreu um erro ao atualizar a ação. Tente novamente.";

  if (!(error instanceof ApiError)) {
    setGeneralError(GENERIC_ERROR);
    return;
  }

  switch (error.status) {
    case 400:
      if (!applyValidationErrors(error.errors, setError)) {
        setGeneralError(GENERIC_ERROR);
      }
      break;
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
    case NETWORK_ERROR_STATUS:
      setGeneralError("Falha de comunicação com o servidor. Tente novamente.");
      break;
    default:
      setGeneralError(GENERIC_ERROR);
      break;
  }
}

export function handleCreateActionApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  setGeneralError: (message: string | null) => void,
): void {
  const GENERIC_ERROR = "Não foi possível criar a ação. Tente novamente.";

  if (!(error instanceof ApiError)) {
    setGeneralError(GENERIC_ERROR);
    return;
  }

  switch (error.status) {
    case 400:
      if (!applyValidationErrors(error.errors, setError)) {
        setGeneralError(GENERIC_ERROR);
      }
      break;
    case 401:
      break;
    case 403:
      setGeneralError("Você não tem permissão para criar esta ação.");
      break;
    case 409:
      setGeneralError("Já existe uma ação com estes dados. Verifique e tente novamente.");
      break;
    case NETWORK_ERROR_STATUS:
      setGeneralError("Falha de comunicação com o servidor. Tente novamente.");
      break;
    default:
      setGeneralError(GENERIC_ERROR);
      break;
  }
}
