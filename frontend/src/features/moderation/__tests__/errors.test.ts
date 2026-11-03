import { describe, expect, it } from "vitest";
import {
  ApiError,
  CONNECTION_ERROR_MESSAGE,
  NETWORK_ERROR_STATUS,
} from "@/services/apiError";
import {
  resolveReportResolutionError,
  resolveReportsListError,
} from "../errors";

describe("moderation error mapping", () => {
  describe("resolveReportsListError", () => {
    it("returns null on 401 so the session handler redirects silently", () => {
      expect(
        resolveReportsListError(new ApiError(401, "No token provided.")),
      ).toBeNull();
    });

    it("marks 403 as forbidden and non-retryable", () => {
      expect(
        resolveReportsListError(new ApiError(403, "User is not a manager.")),
      ).toEqual({
        message:
          "Você não tem permissão para acessar a moderação de denúncias.",
        canRetry: false,
        isForbidden: true,
      });
    });

    it("maps 404 to a non-retryable pt-BR message", () => {
      expect(
        resolveReportsListError(new ApiError(404, "Report not found.")),
      ).toEqual({
        message: "Denúncia não encontrada.",
        canRetry: false,
        isForbidden: false,
      });
    });

    it.each([NETWORK_ERROR_STATUS, 500, 503])(
      "reports a connection failure (%i) as retryable",
      (status) => {
        expect(
          resolveReportsListError(new ApiError(status, "Server down")),
        ).toEqual({
          message: CONNECTION_ERROR_MESSAGE,
          canRetry: true,
          isForbidden: false,
        });
      },
    );

    it("falls back to a generic retryable pt-BR message for unexpected errors", () => {
      expect(resolveReportsListError(new Error("boom"))).toEqual({
        message: "Não foi possível carregar as denúncias. Tente novamente.",
        canRetry: true,
        isForbidden: false,
      });
    });
  });

  describe("resolveReportResolutionError", () => {
    it("identifies an expired session on 401", () => {
      expect(
        resolveReportResolutionError(new ApiError(401, "No token provided.")),
      ).toEqual({ kind: "sessionExpired" });
    });

    it("maps 403 to a non-retryable permission message", () => {
      expect(
        resolveReportResolutionError(
          new ApiError(403, "User is not a manager."),
        ),
      ).toEqual({
        kind: "message",
        text: "Você não tem permissão para resolver esta denúncia.",
        canRetry: false,
      });
    });

    it("maps 404 to notFound so the screen drops the missing item", () => {
      expect(
        resolveReportResolutionError(new ApiError(404, "Report not found.")),
      ).toEqual({
        kind: "notFound",
        text: "Denúncia não encontrada. Ela pode ter sido removida.",
      });
    });

    it.each([NETWORK_ERROR_STATUS, 500])(
      "maps connection failure (%i) to a retryable message",
      (status) => {
        expect(
          resolveReportResolutionError(new ApiError(status, "boom")),
        ).toEqual({
          kind: "message",
          text: CONNECTION_ERROR_MESSAGE,
          canRetry: true,
        });
      },
    );

    it("falls back to a generic retryable message for non-ApiError values", () => {
      expect(resolveReportResolutionError("unexpected")).toEqual({
        kind: "message",
        text: "Não foi possível resolver a denúncia. Tente novamente.",
        canRetry: true,
      });
    });
  });
});
