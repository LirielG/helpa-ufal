import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  VerifyResetCodeRequest,
} from "../types";
import type { UserProfile } from "../types/profile";
import { api } from "./api";

// A 401 on these routes means the credentials were rejected, not that a session
// ended, so they opt out of the client's session-expiry handling and let the
// screen show the message.
const AUTH_REQUEST = { handleUnauthorized: false } as const;

export const authService = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return api.post<LoginResponse>("/auth/login", data, AUTH_REQUEST);
  },

  register(data: RegisterRequest): Promise<RegisterResponse> {
    return api.post<RegisterResponse>("/auth/register", data, AUTH_REQUEST);
  },

  logout(): Promise<void> {
    return api.post<void>("/auth/logout", undefined, AUTH_REQUEST);
  },

  requestPasswordReset(data: ForgotPasswordRequest): Promise<void> {
    return api.post<void>("/auth/forgot-password", data, AUTH_REQUEST);
  },

  verifyPasswordResetCode(data: VerifyResetCodeRequest): Promise<void> {
    return api.post<void>("/auth/forgot-password/verify", data, AUTH_REQUEST);
  },

  resetPassword(data: ResetPasswordRequest): Promise<void> {
    return api.post<void>("/auth/reset-password", data, AUTH_REQUEST);
  },

  // Unlike the routes above, a 401 here does mean the session ended, so it
  // keeps the client's default handling: the same path as any other request.
  me(): Promise<UserProfile> {
    return api.get<UserProfile>("/users/me");
  },
};
