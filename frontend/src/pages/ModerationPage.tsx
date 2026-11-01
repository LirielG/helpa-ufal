import { useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { Footer } from "@/components/Footer";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Pagination } from "@/components/Pagination";
import { ModerationTabs } from "@/features/moderation/components/ModerationTabs";
import { ReportList } from "@/features/moderation/components/ReportList";
import { ConfirmResolutionModal } from "@/features/moderation/components/ConfirmResolutionModal";
import { useModerationReports } from "@/features/moderation/useModerationReports";
import type { Report } from "@/services/contracts/report";
import bgDashboard from "@/assets/bg.svg";

/**
 * Moderation queue restricted to managers (`isManager`).
 *
 * Authentication is enforced by `ProtectedRoute`; manager authorization is
 * enforced by the API (`403` renders a pt-BR permission message with no data).
 */
export function ModerationPage() {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    tab,
    page,
    totalPages,
    data,
    isLoading,
    error,
    selectTab,
    goToPage,
    retry,
    removeOpenReport,
  } = useModerationReports();

  const [pendingReport, setPendingReport] = useState<Report | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const restoreFocusAfterRemoval = () => {
    requestAnimationFrame(() => {
      const nextCard =
        containerRef.current?.querySelector<HTMLElement>("[data-report-card]");
      if (nextCard) {
        nextCard.focus();
        return;
      }

      document.getElementById(`moderation-tab-${tab}`)?.focus();
    });
  };

  const handleSelectTab = (nextTab: typeof tab) => {
    setNotice(null);
    selectTab(nextTab);
  };

  const handleResolved = (resolved: Report) => {
    setPendingReport(null);
    setNotice(null);
    removeOpenReport(resolved.id);
    toast.success("Denúncia marcada como resolvida.");
    restoreFocusAfterRemoval();
  };

  const handleNotFound = (reportId: string, message: string) => {
    setPendingReport(null);
    setNotice(message);
    removeOpenReport(reportId);
    restoreFocusAfterRemoval();
  };

  const emptyMessage =
    tab === "open"
      ? "Nenhuma denúncia em aberto."
      : "Nenhuma denúncia resolvida.";

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
        <div
          ref={containerRef}
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Moderação de denúncias
            </h1>

            {error?.isForbidden ? (
              <div role="alert">
                <Alert type="error" message={error.message} />
              </div>
            ) : (
              <>
                <ModerationTabs
                  activeTab={tab}
                  onChange={handleSelectTab}
                  panelId={panelId}
                />

                <div
                  id={panelId}
                  role="tabpanel"
                  aria-labelledby={`moderation-tab-${tab}`}
                  className="space-y-6"
                >
                  {notice && (
                    <div role="alert">
                      <Alert
                        type="warning"
                        message={notice}
                        onClose={() => setNotice(null)}
                      />
                    </div>
                  )}

                  {isLoading && (
                    <p
                      className="text-gray-500 text-center py-12"
                      role="status"
                    >
                      Carregando denúncias…
                    </p>
                  )}

                  {!isLoading && error && (
                    <div className="space-y-4" role="alert">
                      <Alert type="error" message={error.message} />
                      {error.canRetry && (
                        <Button variant="secondary" size="md" onClick={retry}>
                          Tentar novamente
                        </Button>
                      )}
                    </div>
                  )}

                  {!isLoading && !error && data && (
                    <>
                      {data.items.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                          <p className="text-lg font-medium">{emptyMessage}</p>
                        </div>
                      ) : (
                        <>
                          <ReportList
                            reports={data.items}
                            onResolve={
                              tab === "open"
                                ? (report) => {
                                    setNotice(null);
                                    setPendingReport(report);
                                  }
                                : undefined
                            }
                          />

                          <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPageChange={goToPage}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {pendingReport && (
        <ConfirmResolutionModal
          report={pendingReport}
          onClose={() => setPendingReport(null)}
          onResolved={handleResolved}
          onNotFound={handleNotFound}
        />
      )}
    </DashboardShell>
  );
}
