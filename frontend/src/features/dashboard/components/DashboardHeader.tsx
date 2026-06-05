import { Search, Plus, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import helpaBlueLogo from "../../../assets/helpa-logo-blue-text.svg";

interface DashboardHeaderProps {
  onOpenRegister: () => void;
}

export function DashboardHeader({ onOpenRegister }: DashboardHeaderProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <img src={helpaBlueLogo} alt="helpa" className="h-8 md:h-10 w-auto" />
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ações..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button onClick={onOpenRegister} className="flex items-center gap-2 px-4 py-2 bg-[#1B75BB] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <Plus className="size-5" />
              <span className="hidden sm:inline">Criar uma ação</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                <img
                  src="https://ui-avatars.com/api/?name=Perfil&background=3b82f6&color=fff"
                  alt="Perfil"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700">Perfil</span>
            </div>

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