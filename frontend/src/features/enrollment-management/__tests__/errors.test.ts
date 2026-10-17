import { describe, it, expect } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import { getEnrollmentsErrorMessage } from "../errors";

describe("getEnrollmentsErrorMessage", () => {
  it("returns null for 401 so the session middleware handles the redirect", () => {
    expect(getEnrollmentsErrorMessage(new ApiError(401, "No token."))).toBeNull();
  });

  it("returns the permission message for 403", () => {
    expect(getEnrollmentsErrorMessage(new ApiError(403, "Forbidden"))).toBe(
      "Você não tem permissão para ver os inscritos desta ação.",
    );
  });

  it("returns the not-found message for 404", () => {
    expect(getEnrollmentsErrorMessage(new ApiError(404, "Not found"))).toBe(
      "A ação não foi encontrada ou foi removida.",
    );
  });

  it("returns the network message for a network failure", () => {
    expect(
      getEnrollmentsErrorMessage(new ApiError(NETWORK_ERROR_STATUS, "fail")),
    ).toBe("Falha de comunicação com o servidor. Tente novamente.");
  });

  it("falls back to a generic message for unexpected statuses", () => {
    expect(getEnrollmentsErrorMessage(new ApiError(500, "boom"))).toBe(
      "Erro ao carregar os inscritos. Tente novamente.",
    );
  });
});
