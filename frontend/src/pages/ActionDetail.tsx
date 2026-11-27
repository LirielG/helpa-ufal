import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ActionHero } from "../features/action-detail/components/ActionHero";
import { ActionDescription } from "../features/action-detail/components/ActionDescription";
import { ActionInfoCard } from "../features/action-detail/components/ActionInfoCard";
import { EnrollmentModal } from "../features/action-detail/components/EnrollmentModal";
import { CancelEnrollmentModal } from "../features/action-detail/components/CancelEnrollmentModal";
import { EnrollmentActions } from "../features/action-detail/components/EnrollmentActions";
import { GuestEnrollmentActions } from "../features/action-detail/components/GuestEnrollmentActions";
import { getActionById } from "../features/action-detail/services";
import { ReportActionButton } from "../features/report/components/ReportActionButton";
import { ReportActionModal } from "../features/report/ReportActionModal";
import { useAuth } from "../hooks/useAuth";
import bgDashboard from "../assets/bg.svg";
import type { Activity } from "@/services/contracts/activity";
import { ApiError } from "@/services/apiError";
import { PageTitle } from "../components/PageTitle";

export function ActionDetail() {
  const { id } = useParams<{ id: string }>();

  // A link from one action to another keeps this route element mounted; the
  // key starts the page over, so the previous action (and its title in the
  // tab) doesn't linger while the new one loads.
  return <ActionDetailView key={id} id={id} />;
}

function ActionDetailView({ id }: { id: string | undefined }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [action, setAction] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  // No route tells whether the user already reported this action, so this
  // only reflects what happened while the page is open; a reload falls back
  // to the 409 shown by the modal.
  const [isReported, setIsReported] = useState(false);

  // Stable references: the modal's effect depends on onClose.
  const closeReportModal = useCallback(() => setShowReportModal(false), []);
  const markReported = useCallback(() => setIsReported(true), []);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const getFallbackFocus = useCallback(() => {
    const canFocus = (el: HTMLElement | null): el is HTMLElement =>
      !!el &&
      !el.matches(":disabled") &&
      getComputedStyle(el).display !== "none";

    return canFocus(cancelButtonRef.current)
      ? cancelButtonRef.current
      : titleRef.current;
  }, []);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    getActionById(id)
      .then((data) => {
        if (isMounted) setAction(data);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if (error instanceof ApiError && error.status === 401) return;

        const notFound = error instanceof ApiError && error.status === 404;
        setCanRetry(!notFound);
        setError(
          notFound
            ? "Ação não encontrada."
            : "Não foi possível carregar a ação. Verifique sua conexão e tente novamente.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, loadAttempt]);

  const retryLoad = () => {
    setError(null);
    setCanRetry(false);
    setIsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const restoreEnrollmentFocus = useRef(false);

  // The server is the source of the slots and of enrollmentStatus, so both
  // enrolling and cancelling refetch instead of patching the local copy.
  const refreshAction = async () => {
    if (!id) return;
    try {
      const updatedAction = await getActionById(id);
      setAction(updatedAction);
    } catch {
      restoreEnrollmentFocus.current = false;
      // A failed refresh must not erase the action after a completed enrollment change.
    }
  };

  const handleEnrollmentSuccess = () => {
    restoreEnrollmentFocus.current = true;
    void refreshAction();
  };

  useEffect(() => {
    if (!restoreEnrollmentFocus.current || !action) return;
    restoreEnrollmentFocus.current = false;
    if (document.activeElement === document.body) {
      getFallbackFocus()?.focus();
    }
  }, [action, getFallbackFocus]);

  const handleCancelled = () => {
    setShowCancelModal(false);
    void refreshAction();
  };

  const handleActivityRemoved = () => {
    setShowCancelModal(false);
    setAction(null);
    setError("Esta ação não existe mais.");
  };

  // Convenience only: GET /activities/:id/enrollments still enforces this on
  // the server, and EnrollmentsPage handles a 403 if the stored role is stale.
  const canViewEnrollments = Boolean(
    action && user && (user.id === action.authorId || user.isManager),
  );

  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <PageTitle title={action?.title ?? "Ação"} />
      {isLoading && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500 text-lg">Carregando...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Alert type="error" message={error} />
          {canRetry && (
            <Button
              variant="primary"
              size="md"
              className="mt-4 mr-3"
              onClick={retryLoad}
            >
              Tentar novamente
            </Button>
          )}
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
            titleRef={titleRef}
            actionId={action.id}
            type={action.type}
            category={action.details?.area || action.type}
            title={action.title}
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
            <div className="page-container py-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <ActionDescription
                    description={
                      action.details?.description || "Descrição não informada."
                    }
                  />
                  <ActionInfoCard action={action} />
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                  {isAuthenticated ? (
                    <EnrollmentActions
                      action={action}
                      cancelButtonRef={cancelButtonRef}
                      onEnroll={() => setShowModal(true)}
                      onCancel={() => setShowCancelModal(true)}
                    />
                  ) : (
                    <GuestEnrollmentActions action={action} />
                  )}

                  {canViewEnrollments && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() =>
                        navigate(`/activity/${action.id}/enrollments`)
                      }
                      className="rounded-xl"
                    >
                      Ver inscritos
                    </Button>
                  )}

                  {/* The API answers 401 to visitors and 403 to the author. */}
                  {isAuthenticated && user?.id !== action.authorId && (
                    <ReportActionButton
                      reported={isReported}
                      onClick={() => setShowReportModal(true)}
                      className="self-center"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {showModal && (
            <EnrollmentModal
              action={action}
              onClose={() => setShowModal(false)}
              onSuccess={handleEnrollmentSuccess}
              getFallbackFocus={getFallbackFocus}
            />
          )}

          {showCancelModal && (
            <CancelEnrollmentModal
              action={action}
              onClose={() => setShowCancelModal(false)}
              onCancelled={handleCancelled}
              onActivityRemoved={handleActivityRemoved}
              onActivityClosed={refreshAction}
            />
          )}

          <ReportActionModal
            open={showReportModal}
            actionId={action.id}
            onClose={closeReportModal}
            onReported={markReported}
          />
        </>
      )}
    </DashboardShell>
  );
}
