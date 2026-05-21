import { useState } from "react";
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "../types";
import { authService } from "../services";

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (data: LoginRequest): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response: LoginResponse = await authService.login(data);
      authService.setToken(response.token);
      authService.setUser(response.user);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response: RegisterResponse = await authService.register(data);
      authService.setToken(response.token);
      authService.setUser(response.user);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar conta";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getUser();

  return {
    login,
    register,
    logout,
    isLoading,
    error,
    isAuthenticated,
    user,
  };
};
