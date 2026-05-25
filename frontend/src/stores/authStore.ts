import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { authService } from "../services";
import type { LoginRequest, RegisterRequest, User } from "../types";

type AuthStore = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<boolean>;
  register: (data: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,
      login: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(data);
          set({ user: response.user });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao fazer login";
          set({ error: message });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },
      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.register(data);
          set({ user: response.user });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao criar conta";
          set({ error: message });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },
      logout: async () => {
        set({ isLoading: true, error: null });

        try {
          await authService.logout();
          set({ user: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao fazer logout";
          set({ error: message });
        } finally {
          set({ isLoading: false });
        }
      },
      setUser: (user) => set({ user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "helpa-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);