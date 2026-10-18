interface EnrollmentListHeaderProps {
  total: number;
  /** Enrollments homologated as present, across every page. */
  totalPresent: number;
  /** null while loading or when the lookup failed — the vacancy line is hidden. */
  slots: number | null;
  availableSlots: number | null;
}

/**
 * Displays a summary header with the total number of enrollments and
 * how many of the available slots have been filled.
 *
 * The vacancy line only renders when the slot counts are known. Showing a
 * guess (e.g. "N / N") would read as a full activity.
 */
export function EnrollmentListHeader({
  total,
  totalPresent,
  slots,
  availableSlots,
}: EnrollmentListHeaderProps) {
  const hasSlots = slots !== null && availableSlots !== null;

  return (
    <div className="flex items-center gap-6 py-2">
      <span className="text-gray-700 font-medium">
        <strong>{total}</strong> inscrito{total !== 1 ? "s" : ""}
      </span>
      <span className="text-sm text-gray-500">
        {totalPresent} presente{totalPresent !== 1 ? "s" : ""}
      </span>
      {hasSlots && (
        <span className="text-sm text-gray-500">
          {slots - availableSlots} / {slots} vagas preenchidas
        </span>
      )}
    </div>
  );
}
