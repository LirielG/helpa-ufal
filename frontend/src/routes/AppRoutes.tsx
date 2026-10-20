import { Routes, Route } from "react-router";
import {
  Login,
  Register,
  Dashboard,
  Home,
  ActionDetail,
  Profile,
  EditAction,
  NotFound,
  EnrollmentsPage,
  CertificateValidation,
} from "../pages";

import { useSessionExpiry } from "../hooks/useSessionExpiry";
import { useSessionCheck } from "../hooks/useSessionCheck";
import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { GuestRoute } from "./GuestRoute";

export function AppRoutes() {
  useSessionExpiry();
  // After useSessionExpiry: effects run in order, so the 401 handler is in
  // place before the check can get its answer.
  useSessionCheck();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PublicRoute>
            <Dashboard />
          </PublicRoute>
        }
      />
      <Route
        path="/activity/:id"
        element={
          <PublicRoute>
            <ActionDetail />
          </PublicRoute>
        }
      />

      <Route
        path="/activity/:id/edit"
        element={
          <ProtectedRoute>
            <EditAction />
          </ProtectedRoute>
        }
      />

      <Route
        path="/activity/:id/enrollments"
        element={
          <ProtectedRoute>
            <EnrollmentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      {/* Both paths are printed on issued certificates: never rename them. */}
      <Route
        path="/validar"
        element={
          <PublicRoute>
            <CertificateValidation />
          </PublicRoute>
        }
      />
      <Route
        path="/validar/:validationCode"
        element={
          <PublicRoute>
            <CertificateValidation />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PublicRoute>
            <Home />
          </PublicRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
