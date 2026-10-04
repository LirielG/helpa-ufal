import { describe, it, expect } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import { getReportErrorMessage } from "../errors";

describe("getReportErrorMessage", () => {
  it("returns null on 401, since the session handler already redirects", () => {
    expect(getReportErrorMessage(new ApiError(401, "Unauthorized"))).toBeNull();
  });

  it.each([
    [
      NETWORK_ERROR_STATUS,
      "Falha de comunicação com o servidor. Tente novamente.",
    ],
    [403, "Você não pode denunciar uma ação que você criou."],
    [404, "A ação não foi encontrada. Ela pode ter sido removida."],
    [409, "Você já denunciou esta ação."],
    [500, "Não foi possível registrar a denúncia. Tente novamente."],
  ])("maps status %i to a pt-BR message", (status, message) => {
    expect(getReportErrorMessage(new ApiError(status, "x"))).toBe(message);
  });
});
