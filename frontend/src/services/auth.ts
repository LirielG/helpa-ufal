import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "../types";
import { config } from "../config";

const API_BASE_URL = config.apiUrl;

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Falha ao fazer login");
      }

      return await response.json();
    } catch (error) {
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
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Falha ao criar conta");
      }

      return await response.json();
    } catch (error) {
      throw new Error("Erro na comunicação com o servidor");
    }
  },

  async logout(): Promise<void> {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getToken(): string | null {
    return localStorage.getItem("token");
  },

  setToken(token: string): void {
    localStorage.setItem("token", token);
  },

  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  setUser(user: any): void {
    localStorage.setItem("user", JSON.stringify(user));
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
