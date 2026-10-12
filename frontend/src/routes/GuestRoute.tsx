import type { ReactNode } from "react";
import { Navigate, useLocation, type Location } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { SessionLoader } from "./SessionLoader";

type GuestRouteState = {
  from?: Location;
};

type GuestRouteProps = {
  children: ReactNode;
};

/**
 * Mirror of ProtectedRoute: a screen only a signed-out visitor should see.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const isSessionVerified = useAuthStore((state) => state.isSessionVerified);
  const location = useLocation();

  // The stored user may be stale: redirecting now would bounce a signed-out
  // visitor to the dashboard and back.
  if (isAuthenticated && !isSessionVerified) {
    return <SessionLoader />;
  }

  if (isAuthenticated) {
    const state = location.state as GuestRouteState | null;

    return <Navigate to={state?.from?.pathname ?? "/dashboard"} replace />;
  }

  return children;
}
