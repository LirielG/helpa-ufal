import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../stores/authStore";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => !!state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}