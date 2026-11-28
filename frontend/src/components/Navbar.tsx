import { useLocation } from "react-router";
import helpaBlueLogoT from "../assets/helpa-logo-blue-text.svg";
import { HomeLogoLink } from "./HomeLogoLink";

export function Navbar() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <nav
      className={
        isLoginPage
          ? "bg-white/80 backdrop-blur-sm shadow-sm"
          : "bg-white shadow-sm"
      }
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
        <HomeLogoLink
          src={helpaBlueLogoT}
          imageClassName="h-10 md:h-12 w-auto"
        />
      </div>
    </nav>
  );
}
