import type { ReactNode } from "react";
import { Navigate, useLocation, type Location } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { SessionLoader } from "./SessionLoader";

/**
 * What a screen hands to /login (and the login to /register and back) so
 * GuestRoute can return the visitor to where they started.
 */
export type ReturnToState = {
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
    const state = location.state as ReturnToState | null;

    // The whole location, not just the pathname, so ?feed=sigaa and the
    // like survive the round trip.
    return <Navigate to={state?.from ?? "/dashboard"} replace />;
  }

  return children;
}
