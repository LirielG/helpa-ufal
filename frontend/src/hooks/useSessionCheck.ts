import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

/**
 * Asks the server, once per page load, whether the user restored from
 * localStorage still has a session. The token lives in an httpOnly cookie, so
 * this is the only way to know.
 *
 * Mounted by `AppRoutes` right after `useSessionExpiry`, so a 401 lands on the
 * same handler as any other request. `verifySession` is idempotent, which
 * covers StrictMode's double effect and route changes alike.
 */
export function useSessionCheck(): void {
  useEffect(() => {
    void useAuthStore.getState().verifySession();
  }, []);
}
