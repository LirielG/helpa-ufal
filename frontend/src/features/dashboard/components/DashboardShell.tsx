import { useActionRegister } from "../../../hooks/useActionRegister";
import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { ActionRegister } from "./ActionForm";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import {
  DashboardShellContext,
  type DashboardShellOptions,
} from "./DashboardShellContext";
import { Footer } from "../../../components/Footer";
import { useAuth } from "../../../hooks/useAuth";
import { usePersistedFlag } from "../../../hooks/usePersistedFlag";
import { useAuthStore } from "../../../stores/authStore";
import { SessionLoader } from "../../../routes/SessionLoader";
import { getProfile } from "../../profile/services";
import type { UserProfile } from "../../../types/profile";

type ProfileState = {
  userId: string;
  data: UserProfile | null;
  failed: boolean;
  /** Handed over by a page, so fresher than any read the shell has in flight. */
  synced?: boolean;
};

/**
 * Layout route shared by the pages with the dashboard header and, for a
 * signed-in user, the sidebar. It stays mounted while the user moves between
 * those pages, so the sidebar keeps its state and its profile is fetched once.
 */
export function DashboardShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const isSessionVerified = useAuthStore((state) => state.isSessionVerified);
  // A user restored from localStorage is trusted only once the session check
  // confirms it. The shell is a child of AppRoutes, so its effects run before
  // the check starts: asking for the profile earlier would race it.
  const isCheckingStoredSession = isAuthenticated && !isSessionVerified;
  const userId = isCheckingStoredSession ? null : (user?.id ?? null);
  const isHowItWorks = useMatch("/how-it-works") !== null;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Per browser, not per account. Read only from lg up: below it, the drawer
  // starts closed regardless.
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] =
    usePersistedFlag("helpa.sidebarCollapsed", false);
  const [options, setOptions] = useState<DashboardShellOptions>({});
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [profileReloads, setProfileReloads] = useState(0);

  const { isOpen, openRegisterModal, closeRegisterModal, onSuccessCallback } =
    useActionRegister();

  useEffect(() => closeRegisterModal, [closeRegisterModal]);

  // Each page used to mount its own shell, so leaving a page closed the
  // drawer and the register modal. Now the shell survives navigation (Back
  // included), and has to close them itself.
  const [shownPathname, setShownPathname] = useState(location.pathname);
  if (shownPathname !== location.pathname) {
    setShownPathname(location.pathname);
    setMobileSidebarOpen(false);
  }

  const previousPathname = useRef(location.pathname);
  useEffect(() => {
    if (previousPathname.current === location.pathname) return;

    previousPathname.current = location.pathname;
    closeRegisterModal();
  }, [location.pathname, closeRegisterModal]);

  // Keyed by user, so another account never sees the previous one's profile,
  // not even while its own is loading.
  const ownProfileState =
    profileState && profileState.userId === userId ? profileState : null;

  useEffect(() => {
    if (!userId) return;

    let isCurrent = true;

    getProfile()
      .then((data) => {
        if (!isCurrent) return;

        setProfileState((previous) =>
          previous?.userId === userId && previous.synced
            ? previous
            : { userId, data, failed: false },
        );
      })
      .catch(() => {
        if (isCurrent) {
          setProfileState((previous) =>
            previous?.userId === userId && previous.synced
              ? previous
              : {
                  userId,
                  data: previous?.userId === userId ? previous.data : null,
                  failed: true,
                },
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [userId, profileReloads]);

  const retryProfile = () => {
    if (ownProfileState) {
      setProfileState({ ...ownProfileState, failed: false });
    }
    setProfileReloads((count) => count + 1);
  };

  const shell = useMemo(
    () => ({
      setOptions,
      // Keyed by the profile's own id: one of another account is never shown.
      syncProfile: (profile: UserProfile) =>
        setProfileState({
          userId: profile.id,
          data: profile,
          failed: false,
          synced: true,
        }),
    }),
    [],
  );

  const handleSuccess = (createdId: string) => {
    onSuccessCallback?.();
    navigate(`/activity/${createdId}`);
  };

  // A visitor's Como Funciona is part of the institutional pages, with its
  // own header and no sidebar; the page lays itself out.
  if (isHowItWorks && !isAuthenticated) {
    return <Outlet />;
  }

  // Same as ProtectedRoute: neither the page nor stale data from the stored
  // user flashes before the answer.
  if (isCheckingStoredSession) {
    return <SessionLoader />;
  }

  const showCreateAction = options.showCreateAction ?? true;

  return (
    <DashboardShellContext.Provider value={shell}>
      <div
        className="min-h-screen flex flex-col bg-gray-50"
        style={
          options.background
            ? { backgroundColor: options.background }
            : undefined
        }
      >
        <DashboardHeader
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          onToggleDesktopSidebar={() =>
            setDesktopSidebarCollapsed((collapsed) => !collapsed)
          }
          desktopSidebarCollapsed={desktopSidebarCollapsed}
        />

        <div className="flex-1 flex w-full">
          {isAuthenticated && (
            <DashboardSidebar
              isOpenMobile={mobileSidebarOpen}
              collapsedDesktop={desktopSidebarCollapsed}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              profile={ownProfileState?.data ?? null}
              profileError={ownProfileState?.failed ?? false}
              onRetryProfile={retryProfile}
            />
          )}

          {/* The footer sits in this column, beside the sidebar, so the sticky
              sidebar keeps its place down to the end of the page. */}
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 flex flex-col min-w-0 w-full relative">
              <Outlet />

              {isAuthenticated && showCreateAction && (
                <button
                  type="button"
                  onClick={openRegisterModal}
                  aria-label="Criar uma ação"
                  title="Criar uma ação"
                  className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 h-14 w-14 md:h-auto md:w-auto md:px-4 md:py-2.5 lg:px-5 lg:py-3 md:rounded-xl rounded-full bg-[#00579A] text-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#004884] transition-all flex items-center justify-center gap-1.5 lg:gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B75BB]/50"
                >
                  <Plus className="size-7 md:size-5 lg:size-6 stroke-[2.5]" />
                  <span className="hidden md:inline font-semibold text-sm lg:text-base tracking-wide whitespace-nowrap">
                    Criar uma ação
                  </span>
                </button>
              )}
            </main>

            <footer>
              <Footer />
            </footer>
          </div>
        </div>

        <ActionRegister
          isOpen={isOpen}
          onClose={closeRegisterModal}
          onSuccess={handleSuccess}
        />
      </div>
    </DashboardShellContext.Provider>
  );
}
