import { Routes, Route } from "react-router";
import {
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
  Dashboard,
  Home,
  ActionDetail,
  Profile,
  EditAction,
  NotFound,
  EnrollmentsPage,
  CertificateValidation,
  ModerationPage,
  MyActivities,
  MyCertificates,
  HowItWorks,
} from "../pages";

import { useSessionExpiry } from "../hooks/useSessionExpiry";
import { useSessionCheck } from "../hooks/useSessionCheck";
import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { GuestRoute } from "./GuestRoute";
import { ScrollToTop } from "./ScrollToTop";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";

export function AppRoutes() {
  useSessionExpiry();
  // After useSessionExpiry: effects run in order, so the 401 handler is in
  // place before the check can get its answer.
  useSessionCheck();

  return (
    <>
      <ScrollToTop />
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
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPassword />
            </GuestRoute>
          }
        />
        {/* One shell for every page with the dashboard header, so the sidebar
            stays mounted, with its state, while the user moves between them. */}
        <Route element={<DashboardShell />}>
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
          <Route
            path="/my-activities"
            element={
              <ProtectedRoute>
                <MyActivities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-certificates"
            element={
              <ProtectedRoute>
                <MyCertificates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/moderation"
            element={
              <ProtectedRoute>
                <ModerationPage />
              </ProtectedRoute>
            }
          />
          {/* Unlike /, open to a signed-in user too: the sidebar's Ajuda
              leads here. */}
          <Route
            path="/how-it-works"
            element={
              <PublicRoute>
                <HowItWorks />
              </PublicRoute>
            }
          />
        </Route>
        {/* Both paths are printed on issued certificates: never rename them. */}
        <Route
          path="/validate"
          element={
            <PublicRoute>
              <CertificateValidation />
            </PublicRoute>
          }
        />
        <Route
          path="/validate/:validationCode"
          element={
            <PublicRoute>
              <CertificateValidation />
            </PublicRoute>
          }
        />
        {/* The home page explains the project to visitors; a signed-in user
          already knows it and goes straight to the feed. */}
        <Route
          path="/"
          element={
            <GuestRoute>
              <Home />
            </GuestRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
