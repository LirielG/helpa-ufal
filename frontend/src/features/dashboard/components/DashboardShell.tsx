import { useActionRegister } from "../../../hooks/useActionRegister";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { ActionRegister } from "./ActionForm";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { useAuth } from "../../../hooks/useAuth";
import { getProfile } from "../../profile/services";
import type { UserProfile } from "../../../types/profile";

type DashboardShellProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  containerStyle?: React.CSSProperties;
  showCreateAction?: boolean;
};

let cachedProfileUserId: string | null = null;
let cachedProfileData: UserProfile | null = null;
let inflightProfilePromise: Promise<UserProfile> | null = null;

export function DashboardShell({
  children,
  header,
  footer,
  containerStyle,
  showCreateAction = true,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [wasCreated, setWasCreated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(() =>
    user && cachedProfileUserId === user.id ? cachedProfileData : null,
  );
  const [profileError, setProfileError] = useState(false);

  const { isOpen, openRegisterModal, closeRegisterModal, onSuccessCallback } =
    useActionRegister();

  useEffect(() => closeRegisterModal, [closeRegisterModal]);

  const loadProfile = useCallback(
    async (force = false) => {
      if (!user) {
        cachedProfileUserId = null;
        cachedProfileData = null;
        inflightProfilePromise = null;
        setProfile(null);
        setProfileError(false);
        return;
      }

      if (!force && cachedProfileUserId === user.id && cachedProfileData) {
        setProfile(cachedProfileData);
        setProfileError(false);
        return;
      }

      setProfileError(false);

      try {
        if (!inflightProfilePromise || force) {
          inflightProfilePromise = getProfile();
        }
        const data = await inflightProfilePromise;
        cachedProfileUserId = user.id;
        cachedProfileData = data;
        setProfile(data);
      } catch {
        setProfileError(true);
      } finally {
        inflightProfilePromise = null;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      cachedProfileUserId = null;
      cachedProfileData = null;
      inflightProfilePromise = null;
      setProfile(null);
      setProfileError(false);
      return;
    }

    void loadProfile(false);
  }, [isAuthenticated, loadProfile]);

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
            profile={profile}
            profileError={profileError}
            onRetryProfile={() => void loadProfile(true)}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 w-full relative">
          {children}

          {isAuthenticated && showCreateAction && (
            <button
              type="button"
              onClick={openRegisterModal}
              aria-label="Criar uma ação"
              title="Criar uma ação"
              className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 h-14 w-14 md:h-auto md:w-auto md:px-4 md:py-2.5 lg:px-5 lg:py-3 md:rounded-xl rounded-full bg-[#00579A] text-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#004884] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 lg:gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B75BB]/50"
            >
              <Plus className="size-7 md:size-5 lg:size-6 stroke-[2.5]" />
              <span className="hidden md:inline font-semibold text-sm lg:text-base tracking-wide whitespace-nowrap">
                Criar uma ação
              </span>
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
