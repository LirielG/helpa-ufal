import { describe, it, expect } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import { getEnrollmentErrorMessage, resolveCancellationError } from "../errors";

describe("getEnrollmentErrorMessage", () => {
  describe("401 Unauthorized", () => {
    it("returns null for 401 to let session middleware handle redirect", () => {
      const error = new ApiError(401, "No token provided.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBeNull();
    });

    it("returns null for 401 with expired token", () => {
      const error = new ApiError(
        401,
        "Token malformatted, expired or invalid.",
      );
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBeNull();
    });

    it("returns null for 401 with user not found", () => {
      const error = new ApiError(401, "User account not found or inactive.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBeNull();
    });
  });

  describe("404 Not Found", () => {
    it("returns pt-BR message for activity not found", () => {
      const error = new ApiError(404, "Activity not found.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe(
        "A ação não foi encontrada. Ela pode ter sido removida.",
      );
    });
  });

  describe("400 Validation Error", () => {
    it("returns pt-BR message for validation error", () => {
      const error = new ApiError(400, "Validation error.", [
        {
          field: "activityId",
          message: "activityId must be a valid UUID.",
        },
      ]);
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe(
        "Dados inválidos. Tente recarregar a página e tente novamente.",
      );
    });
  });

  describe("409 Conflict", () => {
    it("returns pt-BR message for activity not open for enrollment", () => {
      const error = new ApiError(409, "Activity is not open for enrollment.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe("As inscrições para esta ação não estão abertas.");
    });

    it("returns pt-BR message for user already enrolled", () => {
      const error = new ApiError(
        409,
        "User is already enrolled in this activity.",
      );
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe("Você já está inscrito nesta ação.");
    });

    it("returns pt-BR message for no available slots", () => {
      const error = new ApiError(409, "No available slots for this activity.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe("Esta ação não tem mais vagas disponíveis.");
    });

    it("returns generic pt-BR message for unknown 409", () => {
      const error = new ApiError(409, "Unknown conflict.");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe(
        "Não foi possível concluir a inscrição. Tente novamente.",
      );
    });
  });

  describe("Network errors", () => {
    it("returns pt-BR message for network error (status 0)", () => {
      const error = new ApiError(
        NETWORK_ERROR_STATUS,
        "Network request failed",
      );
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe(
        "Falha de comunicação com o servidor. Tente novamente.",
      );
    });
  });

  describe("Unknown status", () => {
    it("returns generic pt-BR message for unexpected status", () => {
      const error = new ApiError(500, "Internal server error");
      const message = getEnrollmentErrorMessage(error);
      expect(message).toBe("Erro ao realizar inscrição. Tente novamente.");
    });
  });
});

describe("resolveCancellationError", () => {
  it("treats a missing enrollment as already cancelled", () => {
    const error = new ApiError(404, "Enrollment not found.");
    expect(resolveCancellationError(error)).toEqual({
      kind: "alreadyCancelled",
    });
  });

  it("reports a missing activity as removed", () => {
    const error = new ApiError(404, "Activity not found.");
    expect(resolveCancellationError(error)).toEqual({
      kind: "activityRemoved",
    });
  });

  it("leaves 401 to the session handler", () => {
    const error = new ApiError(401, "Token malformatted, expired or invalid.");
    expect(resolveCancellationError(error)).toEqual({ kind: "sessionExpired" });
  });

  it("explains that a closed activity cannot be cancelled on 409", () => {
    const error = new ApiError(409, "Activity is not open for cancellation.");
    expect(resolveCancellationError(error)).toEqual({
      kind: "message",
      text: "Esta ação não está mais aberta, não é possível cancelar a inscrição.",
    });
  });

  it("reports a communication failure on network error", () => {
    const error = new ApiError(NETWORK_ERROR_STATUS, "Network request failed");
    expect(resolveCancellationError(error)).toEqual({
      kind: "message",
      text: "Falha de comunicação com o servidor. Tente novamente.",
    });
  });

  it("falls back to a generic message on 400", () => {
    const error = new ApiError(400, "Validation error.");
    expect(resolveCancellationError(error)).toEqual({
      kind: "message",
      text: "Não foi possível cancelar a inscrição. Tente novamente.",
    });
  });

  it("falls back to a generic message on an unknown status", () => {
    const error = new ApiError(500, "Erro na comunicação com o servidor");
    expect(resolveCancellationError(error)).toEqual({
      kind: "message",
      text: "Não foi possível cancelar a inscrição. Tente novamente.",
    });
  });

  it("falls back to a generic message on an unknown 404", () => {
    const error = new ApiError(404, "Route not found.");
    expect(resolveCancellationError(error)).toEqual({
      kind: "message",
      text: "Não foi possível cancelar a inscrição. Tente novamente.",
    });
  });

  it("falls back to a generic message when the error is not an ApiError", () => {
    expect(resolveCancellationError(new Error("boom"))).toEqual({
      kind: "message",
      text: "Não foi possível cancelar a inscrição. Tente novamente.",
    });
  });
});
