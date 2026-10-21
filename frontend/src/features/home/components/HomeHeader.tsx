import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Menu, X } from "lucide-react";
import helpaBlueLogo from "../../../assets/helpa-logo-blue-text.svg";

export type HomeTabId = "about" | "how-it-works" | "actions";

interface HomeHeaderProps {
  activeTab: HomeTabId;
  onSelectTab: (tab: HomeTabId) => void;
}

const NAV_TABS: Array<{ id: HomeTabId; label: string }> = [
  { id: "about", label: "Sobre o Projeto" },
  { id: "how-it-works", label: "Como Funciona" },
  { id: "actions", label: "Ações" },
];

export function HomeHeader({ activeTab, onSelectTab }: HomeHeaderProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsMobileMenuOpen(false);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleTabClick = (tab: HomeTabId) => {
    setIsMobileMenuOpen(false);
    onSelectTab(tab);
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-12 h-16 md:h-[80px] flex items-center justify-between gap-4">
        
        <button
          type="button"
          onClick={() => handleTabClick("about")}
          className="shrink-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] focus-visible:ring-offset-2"
          aria-label="Ir para o início"
        >
          <img
            src={helpaBlueLogo}
            alt="Helpa"
            className="h-8 sm:h-9 md:h-10 w-auto"
          />
        </button>

        <nav
          aria-label="Navegação da página inicial"
          className="hidden md:flex items-center gap-6 lg:gap-8 xl:gap-10"
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`py-1 text-sm lg:text-[15px] xl:text-[16px] leading-[17px] tracking-[0.5px] font-medium rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] focus-visible:ring-offset-4 ${
                  isActive
                    ? "text-[#00579A] font-semibold [text-shadow:0px_4px_4px_rgba(0,87,154,0.25)]"
                    : "text-[#44474E] hover:text-[#00579A]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-4 lg:px-5 py-2 text-sm lg:text-[15px] xl:text-[16px] font-semibold tracking-[0.5px] text-[#000A1E] rounded-lg hover:bg-gray-100 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => navigate("/register")}
            className="px-5 lg:px-6 py-2.5 text-sm lg:text-[15px] xl:text-[16px] font-semibold tracking-[0.5px] text-white bg-[#002147] rounded-lg shadow-sm hover:bg-[#00336b] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] focus-visible:ring-offset-2"
          >
            Cadastrar-se
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-menu"
          aria-label={isMobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          className="md:hidden p-2.5 rounded-lg text-[#000A1E] hover:bg-gray-100 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
        >
          {isMobileMenuOpen ? (
            <X className="size-6" />
          ) : (
            <Menu className="size-6" />
          )}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="md:hidden bg-white border-t border-gray-100 px-4 pt-3 pb-6 shadow-lg flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <nav
            aria-label="Navegação mobile da página inicial"
            className="flex flex-col gap-1"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                    isActive
                      ? "bg-[#D6E3FF]/40 text-[#00579A] font-semibold"
                      : "text-[#44474E] hover:bg-gray-50 hover:text-[#00579A]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="h-px bg-gray-100" />

          <div className="flex flex-col sm:flex-row gap-3 px-1">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/login");
              }}
              className="w-full py-2.5 text-sm font-semibold text-[#000A1E] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
            >
              Entrar
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/register");
              }}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#002147] rounded-lg shadow-sm hover:bg-[#00336b] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] focus-visible:ring-offset-2"
            >
              Cadastrar-se
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
