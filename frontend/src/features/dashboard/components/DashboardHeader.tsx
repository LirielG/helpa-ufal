import { Plus, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import helpaBlueLogo from "../../../assets/helpa-logo-blue-text.svg";
import { useAuth } from "../../../hooks/useAuth";
import { getInitials } from "../../../utils/helpers";

interface DashboardHeaderProps {
  onOpenRegister: () => void;
}

export function DashboardHeader({ onOpenRegister }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = getInitials(user?.fullName) || "P";
  const firstName = user?.fullName
    ? user.fullName.trim().split(" ")[0]
    : "Perfil";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="shrink-0 cursor-pointer"
            aria-label="Ir para a página inicial"
          >
            <img
              src={helpaBlueLogo}
              alt="helpa"
              className="h-8 md:h-10 w-auto"
            />
          </button>

          <div className="flex items-center gap-5">
            <button
              onClick={onOpenRegister}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B75BB] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="size-5" />
              <span className="hidden sm:inline">Criar uma ação</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 cursor-pointer"
              aria-label="Abrir perfil"
            >
              <div className="size-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center text-xs font-semibold leading-none shrink-0 overflow-hidden select-none">
                <span>{initials}</span>
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700">
                {firstName}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Sair"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
