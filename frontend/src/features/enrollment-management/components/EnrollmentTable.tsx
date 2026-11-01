import { Button } from "@/components/Button";
import type { EnrollmentListItem } from "@/services/contracts/enrollment";
import { AttendanceBadge } from "./AttendanceBadge";

interface EnrollmentTableProps {
  enrollments: EnrollmentListItem[];
  /** Absent while the activity is not COMPLETED: attendance cannot be homologated yet. */
  onHomologate?: (enrollment: EnrollmentListItem) => void;
}

/**
 * Accessible table of enrolled volunteers.
 *
 * Accessibility notes:
 * - Uses <table> semantics with <th scope="col"> so screen-readers announce
 *   column headers for each data cell.
 * - Focusable via keyboard: the wrapping div is scrollable, rows receive
 *   hover styles, and the table itself is navigable with Tab + arrow keys
 *   when assistive technology is active.
 * - registrationCode is rendered as an empty string when null — teachers
 *   have no registration code and the cell must never display "null".
 */
export function EnrollmentTable({
  enrollments,
  onHomologate,
}: EnrollmentTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm" aria-label="Lista de inscritos">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Nome
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              E-mail
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Matrícula
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Presença
            </th>
            {onHomologate && (
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {enrollments.map((enrollment) => {
            const isFirstHomologation = enrollment.attendanceConfirmed === null;

            return (
              <tr
                key={enrollment.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {enrollment.user.fullName}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {enrollment.user.email}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {/* Explicit empty string when null — never display "null" */}
                  {enrollment.user.registrationCode ?? ""}
                </td>
                <td className="px-4 py-3">
                  <AttendanceBadge enrollment={enrollment} />
                </td>
                {onHomologate && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="whitespace-nowrap"
                      aria-label={`${
                        isFirstHomologation ? "Homologar" : "Editar"
                      } presença de ${enrollment.user.fullName}`}
                      onClick={() => onHomologate(enrollment)}
                    >
                      {isFirstHomologation ? "Homologar" : "Editar"}
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
