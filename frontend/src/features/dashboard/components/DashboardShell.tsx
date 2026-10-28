import { useActionRegister } from "../../../hooks/useActionRegister";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { ActionRegister } from "./ActionForm";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { useAuth } from "../../../hooks/useAuth";

type DashboardShellProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  containerStyle?: React.CSSProperties;
};

export function DashboardShell({
  children,
  header,
  footer,
  containerStyle,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [wasCreated, setWasCreated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { isOpen, openRegisterModal, closeRegisterModal, onSuccessCallback } =
    useActionRegister();

  useEffect(() => closeRegisterModal, [closeRegisterModal]);

  const handleSuccess = () => {
    setWasCreated(true);

    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

  const handleClose = () => {
    const shouldGoToFeed = wasCreated && !onSuccessCallback;
    closeRegisterModal();
    setWasCreated(false);

    if (shouldGoToFeed) {
      navigate("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={containerStyle}
    >
      {header ? (
        <DashboardHeader onToggleSidebar={() => setMobileSidebarOpen(true)} />
      ) : null}

      <div className="flex-1 flex w-full">
        {isAuthenticated && (
          <DashboardSidebar
            isOpenMobile={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 w-full relative">
          {children}

          {isAuthenticated && (
            <button
              type="button"
              onClick={openRegisterModal}
              aria-label="Criar uma ação"
              title="Criar uma ação"
              className="fixed bottom-8 right-8 z-40 size-14 rounded-full bg-[#004884] text-white shadow-xl hover:bg-[#003666] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B75BB]/50"
            >
              <Plus className="size-8 stroke-[2.2]" />
            </button>
          )}
        </main>
      </div>

      {footer && <footer>{footer}</footer>}

      <ActionRegister
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
