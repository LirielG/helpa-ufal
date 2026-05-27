import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Users } from "lucide-react";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ActionHero } from "../features/action-detail/components/ActionHero";
import { ActionDescription } from "../features/action-detail/components/ActionDescription";
import { ActionInfoCard } from "../features/action-detail/components/ActionInfoCard";
import { EnrollmentModal } from "../features/action-detail/components/EnrollmentModal";
import { getActionById } from "../features/action-detail/services";
import { useAuth } from "../hooks/useAuth";
import bgDashboard from "../assets/bg.svg";
import type { ActionDetail as ActionDetailType } from "../features/action-detail/types";

export function ActionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [action, setAction] = useState<ActionDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    getActionById(id)
      .then((data) => {
        if (!data) {
          setError("Ação não encontrada.");
        } else {
          setAction(data);
        }
      })
      .catch(() => setError("Erro ao carregar a ação. Tente novamente."))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      {isLoading && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500 text-lg">Carregando...</p>
        </div>
      )}
      {!isLoading && error && (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Alert type="error" message={error} />
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            ← Voltar
          </Button>
        </div>
      )}
      {!isLoading && action && (
        <>
          <ActionHero
            bannerUrl={action.bannerUrl}
            category={action.category}
            title={action.title}
            shortDescription={action.shortDescription}
            onBack={() => navigate(-1)}
          />
          <div
            className="bg-white flex-1"
            style={{
              backgroundImage: `url(${bgDashboard})`,
              backgroundPosition: "top center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <ActionDescription description={action.fullDescription} />
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                  <ActionInfoCard action={action} />

                  {isAuthenticated && (
                    <Button
                      variant="navy"
                      size="lg"
                      disabled={action.slots === 0}
                      onClick={() => setShowModal(true)}
                      className="flex items-center justify-center gap-3 rounded-xl"
                    >
                      <Users className="size-6" />
                      {action.slots === 0 ? "Vagas esgotadas" : "Inscrever-se"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {showModal && (
            <EnrollmentModal
              action={action}
              onClose={() => setShowModal(false)}
            />
          )}
        </>
      )}
    </DashboardShell>
  );
}
