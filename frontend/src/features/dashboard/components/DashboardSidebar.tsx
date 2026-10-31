import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Clock,
  Home,
  HeartHandshake,
  ChevronDown,
  ChevronRight,
  IdCard,
  BadgeCheck,
  AlertTriangle,
  HelpCircle,
  LogOut,
  X,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { getInitials } from "../../../utils/helpers";

export const SIDEBAR_LABELS = {
  totalContributed: "Total contribuído",
  mainNav: "NAVEGAÇÃO PRINCIPAL",
  home: "Home",
  actions: "Ações",
  enrolledActivities: "Atividades Inscritas",
  completedActivities: "Atividades Concluídas",
  managedActivities: "Atividades Gerenciadas",
  personalData: "Dados Pessoais",
  certificates: "Certificados",
  reports: "Denúncias",
  help: "Ajuda",
  logout: "Sair da conta",
} as const;

export type ActionSubTab = "enrolled" | "completed" | "managed";

interface DashboardSidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const ACTION_SUB_ITEMS: Array<{ id: ActionSubTab; label: string }> = [
  { id: "enrolled", label: SIDEBAR_LABELS.enrolledActivities },
  { id: "completed", label: SIDEBAR_LABELS.completedActivities },
  { id: "managed", label: SIDEBAR_LABELS.managedActivities },
];

export function DashboardSidebar({
  isOpenMobile = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [actionsExpanded, setActionsExpanded] = useState(true);

  const initials = getInitials(user?.fullName) || "U";
  const fullName = user?.fullName || "Usuário";
  const email = user?.email || "";
  const course =
    (user as { course?: string } | null)?.course || "Ciência da Computação";

  const searchParams = new URLSearchParams(location.search);
  const rawSection = searchParams.get("section");

  const activeSubTab: ActionSubTab | null =
    rawSection === "enrolled" ||
    rawSection === "completed" ||
    rawSection === "managed"
      ? rawSection
      : null;

  const isActionSubRoute = activeSubTab !== null;

  const isHomeActive =
    location.pathname === "/dashboard" && !isActionSubRoute;

  const isPersonalDataActive =
    location.pathname === "/profile" && !isActionSubRoute;

  const isCertificatesActive = location.pathname.startsWith("/validar");

  const handleNavigate = (path: string) => {
    onCloseMobile?.();
    navigate(path);
  };

  const handleLogout = async () => {
    onCloseMobile?.();
    await logout();
    navigate("/login");
  };

  const activeMainItemClass = "bg-[#002147] text-white font-medium shadow-xs";
  const inactiveMainItemClass = "text-[#44474E] hover:bg-gray-100 font-medium";

  const sidebarContent = (
    <aside
      aria-label="Menu lateral do usuário"
      className="w-[300px] xl:w-[340px] shrink-0 bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] flex flex-col justify-between min-h-full select-none z-20"
    >
      <div className="flex flex-col">
        <div className="bg-[#F2F4F6] p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-[57px] rounded-full bg-[#002147] text-white border border-[#1D4ED8]/20 flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base leading-5 font-bold text-[#000A1E] truncate">
                  {fullName}
                </h3>
                <p className="text-xs leading-[17px] text-[#44474E] truncate">
                  {email}
                </p>
              </div>
            </div>

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-[#44474E] hover:bg-gray-200/70 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
                aria-label="Fechar menu lateral"
              >
                <X className="size-5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1.5 rounded-[8px] text-xs leading-[15px] font-semibold bg-[#61B1EF]/30 text-[#000C16]">
              {course}
            </span>
            <span className="px-2.5 py-1.5 rounded-[8px] text-xs leading-[15px] font-semibold bg-[#ADF7F9]/41 text-[#004243]">
              UFAL - Arapiraca
            </span>
          </div>

          <div className="bg-[#AEC7F6]/20 rounded-xl p-3.5 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
              <Clock className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs leading-[17px] font-medium text-[#44474E]">
                {SIDEBAR_LABELS.totalContributed}
              </span>
              <span className="text-2xl leading-[34px] font-bold tracking-[-0.6px] text-[#000A1E]">
                0 horas
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-1">
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs leading-[17px] font-bold tracking-[0.6px] uppercase text-[#44474E]">
              {SIDEBAR_LABELS.mainNav}
            </span>
          </div>

          <nav aria-label="Navegação principal" className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard")}
              aria-current={isHomeActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                isHomeActive ? activeMainItemClass : inactiveMainItemClass
              }`}
            >
              <Home className="size-[19px] shrink-0" />
              <span>{SIDEBAR_LABELS.home}</span>
            </button>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setActionsExpanded((prev) => !prev)}
                aria-expanded={actionsExpanded}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                  isActionSubRoute ? activeMainItemClass : inactiveMainItemClass
                }`}
              >
                <span className="flex items-center gap-3">
                  <HeartHandshake className="size-[19px] shrink-0" />
                  <span>{SIDEBAR_LABELS.actions}</span>
                </span>
                {actionsExpanded ? (
                  <ChevronDown className="size-4 shrink-0" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" />
                )}
              </button>

              {actionsExpanded && (
                <div className="py-1">
                  <div className="relative bg-[#F2F4F6]/40 rounded-lg py-2 pl-4 pr-1 flex flex-col gap-1">
                    <div
                      aria-hidden="true"
                      className="absolute left-3 top-2 bottom-2 w-0.5 bg-[#00579A]/80 rounded-full"
                    />

                    {ACTION_SUB_ITEMS.map((subItem) => {
                      const isSubActive = activeSubTab === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() =>
                            handleNavigate(
                              `/profile?section=${subItem.id}&tab=actions`,
                            )
                          }
                          aria-current={isSubActive ? "page" : undefined}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                            isSubActive
                              ? "bg-[#00579A]/35 text-white font-semibold"
                              : "text-[#44474E] font-medium hover:bg-gray-200/50"
                          }`}
                        >
                          {subItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate("/profile")}
              aria-current={isPersonalDataActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                isPersonalDataActive
                  ? activeMainItemClass
                  : inactiveMainItemClass
              }`}
            >
              <IdCard className="size-[18px] shrink-0" />
              <span>{SIDEBAR_LABELS.personalData}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/validar")}
              aria-current={isCertificatesActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${
                isCertificatesActive
                  ? activeMainItemClass
                  : inactiveMainItemClass
              }`}
            >
              <BadgeCheck className="size-5 shrink-0" />
              <span>{SIDEBAR_LABELS.certificates}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm leading-[17px] tracking-[0.7px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A] ${inactiveMainItemClass}`}
            >
              <AlertTriangle className="size-5 text-[#C00F0C] shrink-0" />
              <span>{SIDEBAR_LABELS.reports}</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => handleNavigate("/como-funciona")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm leading-[17px] tracking-[0.7px] font-medium text-[#44474E] hover:bg-gray-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
        >
          <HelpCircle className="size-[17px] text-[#44474E] shrink-0" />
          <span>{SIDEBAR_LABELS.help}</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm leading-[17px] tracking-[0.7px] font-semibold text-[#BA1A1A] hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA1A1A]"
        >
          <LogOut className="size-[15px] text-[#BA1A1A] shrink-0" />
          <span>{SIDEBAR_LABELS.logout}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex">{sidebarContent}</div>
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
