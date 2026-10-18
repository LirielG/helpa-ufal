import type { Enrollment } from "@/services/contracts/enrollment";

interface AttendanceBadgeProps {
  enrollment: Pick<
    Enrollment,
    "attendanceConfirmed" | "confirmedWorkloadHours"
  >;
}

/**
 * The attendance of one enrollment in one of three looks. The state comes from
 * attendanceConfirmed alone: confirmedWorkloadHours is 0 both before any
 * homologation and after an absence, so it cannot tell them apart.
 */
export function AttendanceBadge({ enrollment }: AttendanceBadgeProps) {
  if (enrollment.attendanceConfirmed === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-500">
        Não homologado
      </span>
    );
  }

  if (enrollment.attendanceConfirmed) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Presente · {enrollment.confirmedWorkloadHours} h
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Falta · 0 h
    </span>
  );
}
