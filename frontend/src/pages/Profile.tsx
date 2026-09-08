import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { Alert } from "../components/Alert";
import { ProfileCard } from "../features/profile/components/ProfileCard";
import { ProfileTabs } from "../features/profile/components/ProfileTabs";
import { PersonalDataForm } from "../features/profile/components/PersonalDataForm";
import { CertificatesList } from "../features/profile/components/CertificatesList";
import { ActionsList } from "../features/profile/components/ActionsList";
import { getProfile, updateProfile } from "../features/profile/services";
import type { ProfileTab } from "../features/profile/types";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../stores/authStore";
import type { UpdateProfileRequest, User } from "../types";
import bgDashboard from "../assets/bg.svg";

export function Profile() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ProtectedRoute keeps a signed-out visitor from ever reaching this screen,
  // so the guard below only exists to narrow `User | null`.
  useEffect(() => {
    if (!user) return;

    getProfile(user)
      .then((data) => setProfile(data))
      .catch(() => setLoadError("Erro ao carregar o perfil. Tente novamente."))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleSubmit = async (data: UpdateProfileRequest) => {
    if (!profile) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updated = await updateProfile(profile, data);
      setProfile(updated);
      setUser(updated);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Erro ao salvar o perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <DashboardShell
      header={<DashboardHeader onOpenRegister={() => navigate("/dashboard")} />}
      footer={<Footer />}
    >
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
            <Alert type="error" message={loadError} />
          )}

          {!isLoading && !loadError && profile && (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">
              <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

              <div className="space-y-6 min-w-0">
                <ProfileCard user={profile} />

                <div className="bg-white rounded-2xl shadow-sm p-6">
                  {activeTab === "personal" && (
                    <PersonalDataForm
                      user={profile}
                      onSubmit={handleSubmit}
                      onLogout={handleLogout}
                      isSaving={isSaving}
                      error={saveError}
                      success={saveSuccess}
                      onDismissFeedback={() => {
                        setSaveError(null);
                        setSaveSuccess(false);
                      }}
                    />
                  )}

                  {activeTab === "certificates" && <CertificatesList />}

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
