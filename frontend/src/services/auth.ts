import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "../types";
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
};
