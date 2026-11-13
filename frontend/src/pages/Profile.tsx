import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { Alert } from "../components/Alert";
import { ProfileCard } from "../features/profile/components/ProfileCard";
import { ProfileTabs } from "../features/profile/components/ProfileTabs";
import { PersonalDataForm } from "../features/profile/components/PersonalDataForm";
import { ActionsList } from "../features/profile/components/ActionsList";
import {
  DEFAULT_PROFILE_TAB,
  isProfileTab,
} from "../features/profile/constants";
import { getProfile, updateProfile } from "../features/profile/services";
import type { ProfileTab, UserProfile } from "../features/profile/types";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../stores/authStore";
import type { UpdateProfileRequest } from "../types";
import bgDashboard from "../assets/bg.svg";

const PASSWORD_CHANGED_MESSAGE =
  "Senha alterada. Entre novamente com a nova senha.";

export function Profile() {
  const { logout, user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab = isProfileTab(tabParam)
    ? tabParam
    : DEFAULT_PROFILE_TAB;

  // `replace` keeps the browser's Back from walking through every tab click;
  // the fresh params also drop `filter`, which belongs to the actions tab.
  const handleTabChange = (tab: ProfileTab) => {
    if (tab === activeTab) return;
    setSearchParams(tab === DEFAULT_PROFILE_TAB ? {} : { tab }, {
      replace: true,
    });
  };

  const handleRetry = () => {
    setIsLoading(true);
    setLoadError(null);

    getProfile()
      .then((data) => setProfile(data))
      .catch(() => setLoadError("Erro ao carregar o perfil. Tente novamente."))
      .finally(() => setIsLoading(false));
  };

  // Keyed on the id, not the user object: saving the name replaces the stored
  // user, and the save response already carries the fresh profile.
  const userId = user?.id;

  // ProtectedRoute keeps a signed-out visitor from ever reaching this screen,
  // so the guard below only exists to narrow `string | undefined`.
  useEffect(() => {
    if (!userId) return;

    getProfile()
      .then((data) => setProfile(data))
      .catch(() => setLoadError("Erro ao carregar o perfil. Tente novamente."))
      .finally(() => setIsLoading(false));
  }, [userId]);

  const handleSave = async (data: UpdateProfileRequest) => {
    const updated = await updateProfile(data);

    // A new password revokes every session, this one included, and the API
    // has already cleared the cookie: the user has to sign in again. Dropping
    // the user makes ProtectedRoute redirect to /login on its own, without
    // the message; flushing it first lets the navigation below come last and
    // win. Navigating before dropping the user fails too: GuestRoute sends a
    // signed-in visitor away from /login.
    if (data.newPassword !== undefined) {
      flushSync(() => setUser(null));
      navigate("/login", {
        replace: true,
        state: { successMessage: PASSWORD_CHANGED_MESSAGE },
      });
      return;
    }

    setProfile(updated);
    if (user) setUser({ ...user, fullName: updated.fullName });
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <div
        className="w-full flex-1"
        style={{
          backgroundImage: `url(${bgDashboard})`,
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 py-8">
          {isLoading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <p className="text-gray-500 text-lg">Carregando...</p>
            </div>
          )}

          {!isLoading && loadError && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Alert type="error" message={loadError} />
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 bg-[#1B75BB] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isLoading && !loadError && profile && (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">
              <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />

              <div className="space-y-6 min-w-0">
                <ProfileCard user={profile} />

                <div className="bg-white rounded-2xl shadow-sm p-6">
                  {activeTab === "personal" && (
                    <PersonalDataForm
                      user={profile}
                      onSave={handleSave}
                      onLogout={handleLogout}
                    />
                  )}

                  {activeTab === "actions" && <ActionsList />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
