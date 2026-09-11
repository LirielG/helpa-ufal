import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const GAP = "gap";

/**
 * Page numbers around the current one, with the first and last always present
 * and a single gap marker standing in for each stretch left out.
 */
function buildPages(page: number, totalPages: number): Array<number | string> {
  const pages = new Set<number>([1, totalPages]);

  for (let candidate = page - 1; candidate <= page + 1; candidate += 1) {
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps: Array<number | string> = [];

  sorted.forEach((current, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && current - previous > 1) {
      withGaps.push(`${GAP}-${previous}`);
    }
    withGaps.push(current);
  });

  return withGaps;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);
  const arrowClasses =
    "size-9 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors enabled:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        className={arrowClasses}
      >
        <ChevronLeft className="size-4" />
      </button>

      {pages.map((entry) =>
        typeof entry === "string" ? (
          <span key={entry} aria-hidden="true" className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onPageChange(entry)}
            aria-label={`Página ${entry}`}
            aria-current={entry === page ? "page" : undefined}
            className={`size-9 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              entry === page
                ? "bg-[#072C59] text-white border-[#072C59]"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
        className={arrowClasses}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
