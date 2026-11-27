import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { User } from "lucide-react";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { Alert } from "../components/Alert";
import { PersonalDataForm } from "../features/profile/components/PersonalDataForm";
import { getProfile, updateProfile } from "../features/profile/services";
import {
  DEFAULT_ACTIVITY_STATUS,
  isActivityStatus,
} from "../features/profile/constants";
import type { UserProfile } from "../features/profile/types";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../stores/authStore";
import type { UpdateProfileRequest } from "../types";
import bgDashboard from "../assets/bg.svg";
import { PageTitle } from "../components/PageTitle";

const PASSWORD_CHANGED_MESSAGE =
  "Senha alterada. Entre novamente com a nova senha.";

export function Profile() {
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The lists used to live here, as ?tab=actions&filter=… or, from the
  // sidebar, ?section=…; those links now move to /my-activities.
  const [searchParams] = useSearchParams();
  const legacyFilter =
    searchParams.get("filter") || searchParams.get("section");
  const isLegacyActionsUrl =
    searchParams.get("tab") === "actions" || Boolean(legacyFilter);

  useEffect(() => {
    if (!isLegacyActionsUrl) return;

    const filter = isActivityStatus(legacyFilter)
      ? legacyFilter
      : DEFAULT_ACTIVITY_STATUS;
    navigate(`/my-activities?filter=${filter}`, { replace: true });
  }, [isLegacyActionsUrl, legacyFilter, navigate]);

  const loadProfile = useCallback(() => {
    getProfile()
      .then((data) => setProfile(data))
      .catch(() => setLoadError("Erro ao carregar o perfil. Tente novamente."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleRetry = () => {
    setIsLoading(true);
    setLoadError(null);
    loadProfile();
  };

  // Keyed on the id, not the user object: saving the name replaces the stored
  // user, and the save response already carries the fresh profile.
  const userId = user?.id;

  // ProtectedRoute keeps a signed-out visitor from ever reaching this screen,
  // so the guard below only exists to narrow `string | undefined`.
  useEffect(() => {
    if (!userId || isLegacyActionsUrl) return;

    loadProfile();
  }, [userId, isLegacyActionsUrl, loadProfile]);

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

    // The sidebar reads the name from the auth store, so it updates here too.
    setProfile(updated);
    if (user) setUser({ ...user, fullName: updated.fullName });
  };

  if (isLegacyActionsUrl) {
    return null;
  }

  return (
    <DashboardShell
      header={<DashboardHeader />}
      footer={<Footer />}
      syncedProfile={profile}
    >
      <PageTitle title="Dados Pessoais" />
      <div
        className="w-full flex-1"
        style={{
          backgroundImage: `url(${bgDashboard})`,
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="page-container py-6 md:py-8 space-y-6">
          <h1 className="flex items-center gap-3 text-2xl md:text-4xl font-bold text-[#00579A]">
            <span
              aria-hidden="true"
              className="flex size-9 md:size-11 shrink-0 items-center justify-center rounded-lg bg-[#00579A] text-white"
            >
              <User className="size-5 md:size-6" />
            </span>
            Dados Pessoais
          </h1>

          {isLoading && (
            <div
              role="status"
              className="flex items-center justify-center min-h-[40vh]"
            >
              <p className="text-gray-500 text-lg">Carregando...</p>
            </div>
          )}

          {!isLoading && loadError && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Alert type="error" message={loadError} />
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 bg-[#1B75BB] text-white rounded-lg hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B75BB] transition-colors font-medium cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isLoading && !loadError && profile && (
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-md p-5 sm:p-8 md:p-10">
              <PersonalDataForm user={profile} onSave={handleSave} />
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
