import { useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import bgLogin from "../assets/bg_login.png";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div
      className={`flex flex-col min-h-screen ${isLoginPage ? "bg-[#f8fbff]" : "bg-gradient-to-br from-blue-50 to-indigo-50"}`}
      style={
        isLoginPage
          ? {
              backgroundImage: `url(${bgLogin})`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      <Navbar />
      <main className="flex-1 py-12 px-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}
