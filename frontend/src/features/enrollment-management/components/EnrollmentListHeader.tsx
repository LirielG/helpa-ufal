interface EnrollmentListHeaderProps {
  total: number;
  slots: number;
  availableSlots: number;
}

/**
 * Displays a summary header with the total number of enrollments and
 * how many of the available slots have been filled.
 */
export function EnrollmentListHeader({
  total,
  slots,
  availableSlots,
}: EnrollmentListHeaderProps) {
  const filled = slots - availableSlots;

  return (
    <div className="flex items-center gap-6 py-2">
      <span className="text-gray-700 font-medium">
        <strong>{total}</strong> inscrito{total !== 1 ? "s" : ""}
      </span>
      <span className="text-sm text-gray-500">
        {filled} / {slots} vagas preenchidas
      </span>
    </div>
  );
}
