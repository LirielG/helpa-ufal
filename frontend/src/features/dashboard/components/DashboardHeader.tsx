import { Plus, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import helpaBlueLogo from "../../../assets/helpa-logo-blue-text.svg";
import { useAuth } from "../../../hooks/useAuth";
import { useActionRegister } from "../../../hooks/useActionRegister";
import { getInitials } from "../../../utils/helpers";
import type { ReturnToState } from "../../../routes/GuestRoute";

const CREATE_ACTION_LABEL = "Criar uma ação";
const LOGIN_LABEL = "Entrar";

export function DashboardHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { openRegisterModal } = useActionRegister();

  // A visitor would fill the whole form only to lose it on the 401, so the
  // button goes to the login instead; GuestRoute brings them back here.
  const goToLogin = () =>
    navigate("/login", { state: { from: location } satisfies ReturnToState });

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
              onClick={isAuthenticated ? openRegisterModal : goToLogin}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B75BB] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="size-5" />
              <span className="hidden sm:inline">{CREATE_ACTION_LABEL}</span>
            </button>

            {!isAuthenticated && (
              <button
                type="button"
                onClick={goToLogin}
                className="px-4 py-2 border border-[#1B75BB] text-[#1B75BB] rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                {LOGIN_LABEL}
              </button>
            )}

            {isAuthenticated && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
