import { BrowserRouter as Router } from "react-router";
import { ToastContainer } from "react-toastify";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <Router>
      <AppRoutes />
      <ToastContainer position="top-right" />
    </Router>
  );
}
