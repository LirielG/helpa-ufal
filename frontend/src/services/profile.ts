import type { UpdateProfileRequest, User } from "../types";
import { config } from "../config";
import { useAuthStore } from "../stores/authStore";

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
    // Fallback
  }

  return response.status >= 500
    ? "Erro na comunicação com o servidor"
    : "Falha na requisição";
}

export const profileService = {

  async getProfile(): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        credentials: "include",
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
// Atualizar dados pessoais
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${useAuthStore.getState().token}`,
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
};