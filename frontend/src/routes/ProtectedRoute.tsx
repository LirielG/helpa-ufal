import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { SessionLoader } from "./SessionLoader";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => !!state.user);
  const isSessionVerified = useAuthStore((state) => state.isSessionVerified);
  const location = useLocation();

  // A stored user is only trusted once the server confirms it.
  if (isAuthenticated && !isSessionVerified) {
    return <SessionLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
