import { useEffect } from "react";
import { useNavigate } from "react-router";
import { setSessionExpiredHandler } from "../services";
import { useAuthStore } from "../stores/authStore";

/**
 * Reacts to the API reporting an expired session: drops the stored user and
 * sends the visitor to the login screen.
 *
 * Mounted once by `AppRoutes` so every route is covered — including the public
 * ones, which have no guard to notice the session is gone.
 */
export function useSessionExpiry(): void {
  const navigate = useNavigate();

  useEffect(
    () =>
      setSessionExpiredHandler(() => {
        useAuthStore.getState().setUser(null);
        navigate("/login", { replace: true });
      }),
    [navigate],
  );
}
