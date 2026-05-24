import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../stores/authStore";

type PublicRouteProps = {
  children: ReactNode;
};

export function PublicRoute({ children }: PublicRouteProps) {
  const isAuthenticated = useAuthStore((state) => !!state.user);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}