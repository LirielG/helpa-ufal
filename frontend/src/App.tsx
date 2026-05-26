import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { Login, Register, Dashboard } from "./pages";
import { PublicRoute } from "./routes/PublicRoute";
//import { ProtectedRoute } from "./routes/ProtectedRoute";
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
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Router>
  );
}