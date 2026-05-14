import { useLocation } from "react-router";
import helpaBlueLogoT from "../assets/helpa-logo-blue-text.svg";

export function Navbar() {
  const location = useLocation();

  // Hide profile button on login and register pages
  const hideProfile = location.pathname === "/login" || location.pathname === "/register";
  const isLoginPage = location.pathname === "/login";

  return (
    <nav className={isLoginPage ? "bg-white/80 backdrop-blur-sm shadow-sm" : "bg-white shadow-sm"}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img src={helpaBlueLogoT} alt="helpa" className="h-10 md:h-12 w-auto" />
        </div>
        {!hideProfile && (
          <button className="flex items-center gap-2 text-gray-700 hover:text-gray-900" aria-label="Abrir perfil">
            <svg className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Perfil</span>
          </button>
        )}
      </div>
    </nav>
  );
}
