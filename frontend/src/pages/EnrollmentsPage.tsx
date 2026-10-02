import { useParams, useNavigate } from "react-router";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Pagination } from "@/components/Pagination";
import { EnrollmentTable } from "@/features/action-detail/components/EnrollmentTable";
import { EnrollmentListHeader } from "@/features/action-detail/components/EnrollmentListHeader";
import { useEnrollments } from "@/features/action-detail/useEnrollments";
import { useActionSlots } from "@/features/action-detail/useActionSlots";

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

  // Two parallel requests: enrollments list + activity metadata (for slots).
  const { data, page, totalPages, isLoading, error, goToPage } =
    useEnrollments(id);
  const { slots, availableSlots } = useActionSlots(id);

  return (
    <DashboardShell
      header={<DashboardHeader onOpenRegister={() => navigate("/dashboard")} />}
      footer={<Footer />}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Page title + back navigation */}
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
          >
            ← Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Inscritos</h1>
        </div>

        {/* Loading state */}
        {isLoading && (
          <p className="text-gray-500 text-center py-12" role="status">
            Carregando inscritos…
          </p>
        )}

        {/* Error state — null error = 401, middleware already redirected */}
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

        {/* Content — renders normally even when attendanceConfirmed is null */}
        {!isLoading && error === null && data && (
          <>
            <EnrollmentListHeader
              total={data.total}
              slots={slots ?? data.total}
              availableSlots={availableSlots ?? 0}
            />

            {data.items.length === 0 ? (
              /* Empty state */
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg font-medium">Nenhum inscrito ainda.</p>
                <p className="text-sm mt-1">
                  Quando alguém se inscrever, aparecerá aqui.
                </p>
              </div>
            ) : (
              <>
                <EnrollmentTable enrollments={data.items} />
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
    </DashboardShell>
  );
}
