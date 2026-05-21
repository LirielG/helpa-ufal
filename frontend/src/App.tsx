import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { Login, Register } from "./pages";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}