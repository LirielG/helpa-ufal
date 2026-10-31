import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import helpaBlueLogo from "../../../assets/helpa-logo-blue-text.svg";
import { useAuth } from "../../../hooks/useAuth";
import { useAuthStore } from "../../../stores/authStore";
import type { ReturnToState } from "../../../routes/GuestRoute";

export const HEADER_NAV_ITEMS = [
  { id: "sobre", label: "Sobre o Projeto", path: "/" },
  { id: "como-funciona", label: "Como Funciona", path: "/#como-funciona" },
  { id: "acoes", label: "Ações", path: "/#acoes" },
] as const;

export const HEADER_LABELS = {
  homeAriaLabel: "Ir para a página inicial",
  openProfileAriaLabel: "Abrir perfil",
  openSidebarAriaLabel: "Abrir menu lateral",
  login: "Entrar",
  register: "Cadastrar-se",
} as const;

interface DashboardHeaderProps {
  onToggleSidebar?: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const isSessionVerified = useAuthStore((state) => state.isSessionVerified);
  const [mobileGuestMenuOpen, setMobileGuestMenuOpen] = useState(false);

  const goToLogin = () =>
    navigate("/login", { state: { from: location } satisfies ReturnToState });

  const goToRegister = () =>
    navigate("/register", { state: { from: location } satisfies ReturnToState });

  const isNavItemActive = (itemPath: string) => {
    if (itemPath === "/") {
      return location.pathname === "/" && !location.hash;
    }
    if (itemPath.startsWith("/#")) {
      return location.pathname === "/" && location.hash === itemPath.slice(1);
    }
    return location.pathname.startsWith(itemPath);
  };

  if (isAuthenticated && !isSessionVerified && !user) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-16 md:h-20 flex items-center">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
          <img src={helpaBlueLogo} alt="helpa" className="h-8 md:h-10 w-auto" />
        </div>
      </header>
    );
  }

  if (isAuthenticated) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-16 md:h-20 flex items-center">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
                aria-label={HEADER_LABELS.openSidebarAriaLabel}
              >
                <Menu className="size-6" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="shrink-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
              aria-label={HEADER_LABELS.homeAriaLabel}
            >
              <img
                src={helpaBlueLogo}
                alt="helpa"
                className="h-8 md:h-10 w-auto"
              />
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-12 h-16 md:h-20 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="shrink-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
          aria-label={HEADER_LABELS.homeAriaLabel}
        >
          <img
            src={helpaBlueLogo}
            alt="helpa"
            className="h-8 sm:h-9 md:h-10 w-auto"
          />
        </button>

        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-6 lg:gap-8"
        >
          {HEADER_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.path);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
                className={`py-1 text-sm lg:text-[15px] font-medium rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                  active
                    ? "text-[#00579A] font-semibold"
                    : "text-[#44474E] hover:text-[#00579A]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={goToLogin}
            className="px-4 py-2 text-sm lg:text-[15px] font-semibold text-[#000A1E] rounded-lg hover:bg-gray-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
          >
            {HEADER_LABELS.login}
          </button>
          <button
            type="button"
            onClick={goToRegister}
            className="px-5 py-2.5 text-sm lg:text-[15px] font-semibold text-white bg-[#002147] rounded-lg hover:bg-[#00336b] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
          >
            {HEADER_LABELS.register}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileGuestMenuOpen((prev) => !prev)}
          aria-expanded={mobileGuestMenuOpen}
          aria-label="Menu de navegação"
          className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
        >
          {mobileGuestMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileGuestMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-4 flex flex-col gap-3">
          <nav aria-label="Navegação mobile" className="flex flex-col gap-1">
            {HEADER_NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item.path);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileGuestMenuOpen(false);
                    navigate(item.path);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? "bg-[#D6E3FF]/40 text-[#00579A] font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={goToLogin}
              className="flex-1 py-2 text-sm font-semibold text-[#000A1E] border border-gray-200 rounded-lg"
            >
              {HEADER_LABELS.login}
            </button>
            <button
              type="button"
              onClick={goToRegister}
              className="flex-1 py-2 text-sm font-semibold text-white bg-[#002147] rounded-lg"
            >
              {HEADER_LABELS.register}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
