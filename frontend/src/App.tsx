import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { Login, Register, Dashboard, ActionDetail, Profile, EditAction } from "./pages";
import { PublicRoute } from "./routes/PublicRoute";
import { useAuthStore } from "./stores/authStore";

function HomeRedirect() {
  const isAuthenticated = useAuthStore((state) => !!state.user);

  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
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
            <PublicRoute>
              <EditAction />
            </PublicRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PublicRoute>
              <Profile />
            </PublicRoute>
          }
        />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Router>
  );
}
