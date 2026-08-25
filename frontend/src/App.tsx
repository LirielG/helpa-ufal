import { BrowserRouter as Router } from "react-router";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
