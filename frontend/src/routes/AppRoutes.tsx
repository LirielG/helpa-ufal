import { Routes, Route, Navigate } from "react-router";
import {
  Login,
  Register,
  Dashboard,
  ActionDetail,
  Profile,
  EditAction,
} from "../pages";
import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { GuestRoute } from "./GuestRoute";

export function AppRoutes() {
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
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
