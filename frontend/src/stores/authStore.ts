import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiError, authService, notifySessionExpired } from "../services";
import type { LoginRequest, RegisterRequest, User } from "../types";

type AuthStore = {
  user: User | null;
  /**
   * Whether the stored user was confirmed by the server on this page load.
   * Never persisted: a user restored from localStorage starts unverified, and
   * the route guards wait instead of trusting it.
   */
  isSessionVerified: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<boolean>;
  register: (data: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  verifySession: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
};

// Shared by concurrent callers (StrictMode runs effects twice in dev), so the
// check hits the server once per load.
let pendingVerification: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isSessionVerified: false,
      isLoading: false,
      error: null,
      login: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(data);
          set({ user: response.user, isSessionVerified: true });
          return true;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro ao fazer login";
          set({ error: message });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },
      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          // Sign-up does not authenticate: the screen sends the visitor to the
          // login page and this only reports whether the account was created.
          await authService.register(data);
          return true;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro ao criar conta";
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
        } catch {
          // Logout fails open: the visitor asked to leave, so the local session
          // is dropped either way. Reporting the failure would only paint an
          // error over the login screen they are sent to, with nothing to act
          // on — and keeping them signed in would not clear the cookie either.
        } finally {
          set({ user: null, isLoading: false });
        }
      },
      verifySession: () => {
        if (get().isSessionVerified) return Promise.resolve();

        // Without a stored user there is nothing to confirm, and asking would
        // turn the 401 into a redirect that drags a guest off public pages.
        if (!get().user) {
          set({ isSessionVerified: true });
          return Promise.resolve();
        }

        pendingVerification ??= authService
          .me()
          .then((me) => {
            // The user may have logged out while the request was in flight.
            if (!get().user) return;

            // The server is the source of truth: the stored copy is replaced,
            // not merged, keeping only the fields `User` describes.
            set({
              user: {
                id: me.id,
                email: me.email,
                fullName: me.fullName,
                userType: me.userType,
                isManager: me.isManager,
                createdAt: me.createdAt,
              },
            });
          })
          .catch((error) => {
            // A 401 was already handled by the HTTP client's session-expiry
            // handler. The backend answers 404 when the token is still valid
            // but the account is gone, which also ends the session; the same
            // handler drops the user and goes to the login screen. Any other
            // failure (no response, 5xx) proves nothing about the session, so
            // the stored user is kept.
            if (error instanceof ApiError && error.status === 404) {
              notifySessionExpired();
            }
          })
          .finally(() => {
            pendingVerification = null;
            set({ isSessionVerified: true });
          });

        return pendingVerification;
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
