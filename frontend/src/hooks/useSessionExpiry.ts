import { useEffect } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";
import { setSessionExpiredHandler } from "../services";
import { useAuthStore } from "../stores/authStore";

/**
 * Certificate validation serves people who came to check someone else's
 * document, often with no account: an expired session must not take them away
 * from the result.
 */
function staysOnExpiry(pathname: string): boolean {
  // matchPath ignores letter case, like the router that opened the page.
  return matchPath("/validate/:validationCode?", pathname) !== null;
}

/**
 * Reacts to the API reporting an expired session: drops the stored user and
 * sends the visitor to the login screen.
 *
 * Mounted once by `AppRoutes` so every route is covered — including the public
 * ones, which have no guard to notice the session is gone.
 */
export function useSessionExpiry(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(
    () =>
      setSessionExpiredHandler(() => {
        useAuthStore.getState().setUser(null);
        if (staysOnExpiry(pathname)) return;
        navigate("/login", { replace: true });
      }),
    [navigate, pathname],
  );
}
