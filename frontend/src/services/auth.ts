import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "../types";
import { config } from "../config";

const API_BASE_URL = config.apiUrl;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join("\n");
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Use fallback message below.
  }

  return response.status >= 500
    ? "Erro na comunicação com o servidor"
    : "Falha na requisição";
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message !== "Falha na requisição") {
        throw error;
      }

      throw new Error("Erro na comunicação com o servidor");
    }
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message !== "Falha na requisição") {
        throw error;
      }

      throw new Error("Erro na comunicação com o servidor");
    }
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
  },
};
