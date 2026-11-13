import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  NETWORK_ERROR_STATUS,
  CONNECTION_ERROR_MESSAGE,
} from "@/services/apiError";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  REGISTER_ALREADY_IN_USE_MESSAGE,
  REGISTER_GENERIC_ERROR_MESSAGE,
  REGISTER_INVALID_DATA_MESSAGE,
} from "../constants/messages";
import { getLoginErrorMessage, handleRegisterApiErrors } from "../errors";

// Any text works: the screens must never depend on the API's wording.
const UNRELATED_MESSAGE = "Some text the backend may change at any time.";

function conflict(details?: Record<string, unknown>) {
  return new ApiError(409, UNRELATED_MESSAGE, [], {
    code: "ALREADY_IN_USE",
    details,
  });
}

describe("getLoginErrorMessage", () => {
  it.each([
    ["wrong credentials (401)", 401, INVALID_CREDENTIALS_MESSAGE],
    ["no response", NETWORK_ERROR_STATUS, CONNECTION_ERROR_MESSAGE],
    ["a server failure (500)", 500, CONNECTION_ERROR_MESSAGE],
    ["a server failure (503)", 503, CONNECTION_ERROR_MESSAGE],
    ["any other status", 400, LOGIN_GENERIC_ERROR_MESSAGE],
  ])("translates %s", (_case, status, expected) => {
    expect(getLoginErrorMessage(new ApiError(status, UNRELATED_MESSAGE))).toBe(
      expected,
    );
  });

  it("falls back to the generic message for an error that is not an ApiError", () => {
    expect(getLoginErrorMessage(new Error("Invalid credentials."))).toBe(
      LOGIN_GENERIC_ERROR_MESSAGE,
    );
  });
});

describe("handleRegisterApiErrors", () => {
  it.each([
    ["email", "Este e-mail já está cadastrado."],
    ["registrationCode", "Esta matrícula já está cadastrada."],
    ["cndb", "Esta CNDB já está cadastrada."],
  ])(
    "puts a 409 on the %s field and leaves nothing for the alert",
    (field, message) => {
      const setError = vi.fn();

      const alert = handleRegisterApiErrors(conflict({ field }), setError);

      expect(alert).toBeNull();
      expect(setError).toHaveBeenCalledExactlyOnceWith(field, {
        type: "server",
        message,
      });
    },
  );

  it.each([
    ["no details", undefined],
    ["no field", {}],
    ["an unknown field", { field: "fullName" }],
  ])(
    "returns the generic conflict message for a 409 with %s",
    (_case, details) => {
      const setError = vi.fn();

      expect(handleRegisterApiErrors(conflict(details), setError)).toBe(
        REGISTER_ALREADY_IN_USE_MESSAGE,
      );
      expect(setError).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a validation error (400)", 400, REGISTER_INVALID_DATA_MESSAGE],
    ["no response", NETWORK_ERROR_STATUS, CONNECTION_ERROR_MESSAGE],
    ["a server failure (500)", 500, CONNECTION_ERROR_MESSAGE],
    ["any other status", 422, REGISTER_GENERIC_ERROR_MESSAGE],
  ])("translates %s", (_case, status, expected) => {
    const setError = vi.fn();

    expect(
      handleRegisterApiErrors(
        new ApiError(status, UNRELATED_MESSAGE),
        setError,
      ),
    ).toBe(expected);
    expect(setError).not.toHaveBeenCalled();
  });

  it("falls back to the generic message for an error that is not an ApiError", () => {
    expect(handleRegisterApiErrors(new Error("boom"), vi.fn())).toBe(
      REGISTER_GENERIC_ERROR_MESSAGE,
    );
  });
});
