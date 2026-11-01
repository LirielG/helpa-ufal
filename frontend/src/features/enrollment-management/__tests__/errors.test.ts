import { describe, it, expect } from "vitest";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import { getEnrollmentsErrorMessage, resolveAttendanceError } from "../errors";

describe("getEnrollmentsErrorMessage", () => {
  it("returns null for 401 so the session middleware handles the redirect", () => {
    expect(
      getEnrollmentsErrorMessage(new ApiError(401, "No token.")),
    ).toBeNull();
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
    ).toBe("Não foi possível conectar ao servidor. Tente novamente.");
  });

  it("falls back to a generic message for unexpected statuses", () => {
    expect(getEnrollmentsErrorMessage(new ApiError(418, "boom"))).toBe(
      "Erro ao carregar os inscritos. Tente novamente.",
    );
  });
});

describe("resolveAttendanceError", () => {
  it("stays silent on 401, which the HTTP client already handed to the session", () => {
    expect(
      resolveAttendanceError(new ApiError(401, "No token provided.")),
    ).toEqual({ kind: "sessionExpired" });
  });

  it("explains a 403 as a missing permission", () => {
    expect(
      resolveAttendanceError(
        new ApiError(
          403,
          "Only the activity creator or a manager can confirm attendance.",
        ),
      ),
    ).toEqual({
      kind: "message",
      text: "Você não tem permissão para homologar esta presença.",
    });
  });

  it("asks for a reload on 404", () => {
    expect(
      resolveAttendanceError(new ApiError(404, "Enrollment not found.")),
    ).toEqual({ kind: "stale", text: "Inscrição não encontrada." });
  });

  it("asks for a reload when the activity is no longer completed", () => {
    expect(
      resolveAttendanceError(
        new ApiError(409, "Arbitrary backend error message", [], {
          code: "ACTIVITY_NOT_COMPLETED",
        }),
      ),
    ).toEqual({
      kind: "stale",
      text: "Esta ação não está mais concluída, então a presença não pode ser homologada.",
    });
  });

  it("asks for a reload when the enrollment is no longer approved", () => {
    expect(
      resolveAttendanceError(
        new ApiError(409, "Arbitrary backend error message", [], {
          code: "ENROLLMENT_NOT_APPROVED",
        }),
      ),
    ).toEqual({
      kind: "stale",
      text: "Esta inscrição não está mais aprovada, então a presença não pode ser homologada.",
    });
  });

  it("puts a 422 on the hours field", () => {
    expect(
      resolveAttendanceError(
        new ApiError(
          422,
          "workloadHours must be an integer between 1 and the activity's workload hours.",
        ),
      ),
    ).toEqual({
      kind: "field",
      text: "Informe um número inteiro de horas entre 1 e a carga horária da ação.",
    });
  });

  it("puts a 400 about workloadHours on the hours field", () => {
    expect(
      resolveAttendanceError(
        new ApiError(400, "Validation error.", [
          {
            field: "workloadHours",
            message: "workloadHours is required when attended is true.",
          },
        ]),
      ),
    ).toEqual({
      kind: "field",
      text: "Horas incompatíveis com a presença informada.",
    });
  });

  it("falls back to a generic message for any other 400", () => {
    expect(
      resolveAttendanceError(
        new ApiError(400, "Validation error.", [
          { field: "attended", message: "Invalid input" },
        ]),
      ),
    ).toEqual({
      kind: "message",
      text: "Dados inválidos. Recarregue a página e tente novamente.",
    });
  });

  it("reports a network failure", () => {
    expect(
      resolveAttendanceError(new ApiError(NETWORK_ERROR_STATUS, "fail")),
    ).toEqual({
      kind: "message",
      text: "Não foi possível conectar ao servidor. Tente novamente.",
    });
  });

  it("falls back to a generic message for unexpected failures", () => {
    const generic = {
      kind: "message",
      text: "Não foi possível homologar a presença. Tente novamente.",
    };

    expect(resolveAttendanceError(new ApiError(418, "boom"))).toEqual(generic);
    expect(resolveAttendanceError(new Error("boom"))).toEqual(generic);
  });
});
