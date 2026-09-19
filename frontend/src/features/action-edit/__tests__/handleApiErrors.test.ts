import { describe, expect, it, vi } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import type { ActionEditSchemaType } from "../validators";
import { handleActionApiErrors } from "../handleApiErrors";

const GENERIC_ERROR = "Ocorreu um erro ao atualizar a ação. Tente novamente.";

function callWith(error: unknown) {
  const setError = vi.fn();
  const setGeneralError = vi.fn();
  const navigate = vi.fn();

  handleActionApiErrors<ActionEditSchemaType>(
    error,
    setError,
    setGeneralError,
    navigate,
  );

  return { setError, setGeneralError, navigate };
}

/** Shape the API answers a failed validation with. */
function validationError(
  errors: Array<{ field: string; message: string }>,
): ApiError {
  return new ApiError(400, "Validation error.", errors);
}

describe("handleActionApiErrors", () => {
  describe("400", () => {
    it("puts a pt-BR message on the field the API rejected", () => {
      const { setError, setGeneralError } = callWith(
        validationError([
          { field: "address.zipCode", message: "zipCode must contain exactly 8 digits." },
        ]),
      );

      expect(setError).toHaveBeenCalledWith("address.zipCode", {
        type: "server",
        message: "O CEP deve ter 8 dígitos.",
      });
      expect(setGeneralError).not.toHaveBeenCalled();
    });

    it("never repeats the English text the API sent", () => {
      const { setError } = callWith(
        validationError([
          { field: "startDate", message: "startDate must be in the future." },
        ]),
      );

      expect(setError).toHaveBeenCalledWith("startDate", {
        type: "server",
        message: "A data de início deve ser futura e anterior à de encerramento.",
      });
    });

    it("keeps the enrollment count when translating the slots error", () => {
      const { setError } = callWith(
        validationError([
          {
            field: "slots",
            message:
              "slots cannot be reduced below the current number of approved enrollments (13).",
          },
        ]),
      );

      expect(setError).toHaveBeenCalledWith("slots", {
        type: "server",
        message:
          "A quantidade de vagas não pode ser menor que o número atual de inscrições aprovadas (13).",
      });
    });

    it("falls back to the generic slots message when there is no count", () => {
      const { setError } = callWith(
        validationError([{ field: "slots", message: "slots is invalid." }]),
      );

      expect(setError).toHaveBeenCalledWith("slots", {
        type: "server",
        message: "Informe uma quantidade de vagas válida.",
      });
    });

    it("shows a missing address on the first field of the block", () => {
      const { setError } = callWith(
        validationError([
          { field: "address", message: "Address is required when format is IN_PERSON." },
        ]),
      );

      expect(setError).toHaveBeenCalledWith("address.addressLine", {
        type: "server",
        message: "Informe o logradouro.",
      });
    });

    it("assigns one message per rejected field", () => {
      const { setError } = callWith(
        validationError([
          { field: "title", message: "Too small: expected string to have >=1 characters" },
          { field: "workloadHours", message: "Too small: expected number to be >=1" },
        ]),
      );

      expect(setError).toHaveBeenCalledTimes(2);
    });

    it("falls back to the general error when the field is unknown", () => {
      const { setError, setGeneralError } = callWith(
        validationError([{ field: "status", message: "Unexpected field." }]),
      );

      expect(setError).not.toHaveBeenCalled();
      expect(setGeneralError).toHaveBeenCalledWith(GENERIC_ERROR);
    });

    it("falls back to the general error when no field came back", () => {
      const { setGeneralError } = callWith(new ApiError(400, "Body cannot be empty."));

      expect(setGeneralError).toHaveBeenCalledWith(GENERIC_ERROR);
    });
  });

  it("sends an expired session to the login screen", () => {
    const { navigate, setGeneralError } = callWith(
      new ApiError(401, "Token malformatted, expired or invalid."),
    );

    expect(navigate).toHaveBeenCalledWith("/login");
    expect(setGeneralError).not.toHaveBeenCalled();
  });

  it.each([
    [403, "Apenas o autor ou gestor pode editar esta ação."],
    [404, "Ação não encontrada ou removida."],
    [409, "Ações concluídas ou canceladas não podem ser editadas."],
    [
      NETWORK_ERROR_STATUS,
      "Falha de comunicação com o servidor. Tente novamente.",
    ],
    [500, GENERIC_ERROR],
  ])("answers %i with its own pt-BR message", (status, message) => {
    const { setGeneralError } = callWith(new ApiError(status, "whatever"));

    expect(setGeneralError).toHaveBeenCalledWith(message);
  });

  it("falls back to the generic message for a plain exception", () => {
    const { setGeneralError, setError, navigate } = callWith(
      new TypeError("Cannot read properties of undefined"),
    );

    expect(setGeneralError).toHaveBeenCalledWith(GENERIC_ERROR);
    expect(setError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
