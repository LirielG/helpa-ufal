import type { UseFormSetError } from "react-hook-form";
import { ApiError, NETWORK_ERROR_STATUS } from "@/services/apiError";
import type { RegisterFields } from "@/validators/auth";
import {
  CONNECTION_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  REGISTER_ALREADY_IN_USE_MESSAGE,
  REGISTER_FIELD_IN_USE_MESSAGES,
  REGISTER_GENERIC_ERROR_MESSAGE,
  REGISTER_INVALID_DATA_MESSAGE,
} from "./constants/messages";

// The API's `message` is English text for debugging, so the screens pick their
// text from the status and the `code`, never from it.

type RegisterConflictField = keyof typeof REGISTER_FIELD_IN_USE_MESSAGES;

function isConnectionFailure(error: ApiError): boolean {
  return error.status === NETWORK_ERROR_STATUS || error.status >= 500;
}

function isConflictField(field: unknown): field is RegisterConflictField {
  return (
    typeof field === "string" &&
    Object.hasOwn(REGISTER_FIELD_IN_USE_MESSAGES, field)
  );
}

export function getLoginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return LOGIN_GENERIC_ERROR_MESSAGE;
  if (isConnectionFailure(error)) return CONNECTION_ERROR_MESSAGE;

  // The API answers the same 401 for an unknown e-mail and a wrong password,
  // so the screen does not tell them apart either.
  if (error.status === 401) return INVALID_CREDENTIALS_MESSAGE;

  return LOGIN_GENERIC_ERROR_MESSAGE;
}

/**
 * Puts a duplicated value on its sign-up field and returns the message for the
 * form-level alert, or null when there is nothing left to show there. The
 * form is never reset, so the visitor keeps what they typed.
 */
export function handleRegisterApiErrors(
  error: unknown,
  setError: UseFormSetError<RegisterFields>,
): string | null {
  if (!(error instanceof ApiError)) return REGISTER_GENERIC_ERROR_MESSAGE;
  if (isConnectionFailure(error)) return CONNECTION_ERROR_MESSAGE;

  switch (error.status) {
    case 400:
      return REGISTER_INVALID_DATA_MESSAGE;
    case 409: {
      const field = error.details?.field;

      if (error.code === "ALREADY_IN_USE" && isConflictField(field)) {
        setError(field, {
          type: "server",
          message: REGISTER_FIELD_IN_USE_MESSAGES[field],
        });
        return null;
      }

      return REGISTER_ALREADY_IN_USE_MESSAGE;
    }
    default:
      return REGISTER_GENERIC_ERROR_MESSAGE;
  }
}
