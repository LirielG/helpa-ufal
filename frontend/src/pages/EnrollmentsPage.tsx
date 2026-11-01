import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Pagination } from "@/components/Pagination";
import { EnrollmentTable } from "@/features/enrollment-management/components/EnrollmentTable";
import { EnrollmentListHeader } from "@/features/enrollment-management/components/EnrollmentListHeader";
import { useEnrollments } from "@/features/enrollment-management/useEnrollments";
import { useEnrollmentActivity } from "@/features/enrollment-management/useEnrollmentActivity";
import { AttendanceModal } from "@/features/enrollment-management/components/AttendanceModal";
import type { EnrollmentListItem } from "@/services/contracts/enrollment";

/**
 * Page that displays the list of volunteers enrolled in an activity.
 *
 * Access control: the route is ProtectedRoute — unauthenticated users are
 * redirected to login. Authorization (creator / manager only) is enforced
 * server-side; a 403 response shows a pt-BR permission message here.
 */
export function EnrollmentsPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Two parallel requests: enrollments list + activity metadata (slots,
  // status and workload).
  const {
    data,
    page,
    totalPages,
    isLoading,
    error,
    goToPage,
    applyAttendance,
  } = useEnrollments(id);
  const { activity, reload: reloadActivity } = useEnrollmentActivity(id);
  const [homologating, setHomologating] = useState<EnrollmentListItem | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  // Without the activity there is no status to check nor workload to cap the
  // hours, so the control stays hidden until both are known.
  const workloadCeiling =
    activity?.status === "COMPLETED"
      ? activity.details?.workloadHours
      : undefined;

  const openHomologation = (enrollment: EnrollmentListItem) => {
    setNotice(null);
    setHomologating(enrollment);
  };

  // The status or the enrollment changed since the list loaded: refetch both,
  // so the controls match what the server will accept.
  const handleStale = (message: string) => {
    setHomologating(null);
    setNotice(message);
    void goToPage(page);
    reloadActivity();
  };

  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            ← Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Inscritos</h1>
        </div>

        {notice && <Alert type="warning" message={notice} />}

        {isLoading && (
          <p className="text-gray-500 text-center py-12" role="status">
            Carregando inscritos…
          </p>
        )}

        {!isLoading && error !== null && error !== undefined && (
          <div className="space-y-4">
            <Alert type="error" message={error} />
            <Button
              variant="secondary"
              size="md"
              onClick={() => goToPage(page)}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && error === null && data && (
          <>
            <EnrollmentListHeader
              total={data.total}
              totalPresent={data.totalPresent}
              slots={activity?.slots ?? null}
              availableSlots={activity?.availableSlots ?? null}
            />

            {data.items.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg font-medium">Nenhum inscrito ainda.</p>
                <p className="text-sm mt-1">
                  Quando alguém se inscrever, aparecerá aqui.
                </p>
              </div>
            ) : (
              <>
                <EnrollmentTable
                  enrollments={data.items}
                  onHomologate={
                    workloadCeiling === undefined ? undefined : openHomologation
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

      {homologating && workloadCeiling !== undefined && (
        <AttendanceModal
          enrollment={homologating}
          workloadCeiling={workloadCeiling}
          onClose={() => setHomologating(null)}
          onSaved={(updated) => {
            applyAttendance(updated);
            setHomologating(null);
          }}
          onStale={handleStale}
        />
      )}
    </DashboardShell>
  );
}
