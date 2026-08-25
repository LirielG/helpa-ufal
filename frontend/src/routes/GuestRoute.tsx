import type { ReactNode } from "react";
import { Navigate, useLocation, type Location } from "react-router";
import { useAuthStore } from "../stores/authStore";

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
  const location = useLocation();

  if (isAuthenticated) {
    const state = location.state as GuestRouteState | null;

    return <Navigate to={state?.from?.pathname ?? "/dashboard"} replace />;
  }

  return children;
}
