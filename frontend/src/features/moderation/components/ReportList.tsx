import { useRef, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { REPORT_REASONS } from "@/features/report/constants/reportReasons";
import type { Report, ReportReason } from "@/services/contracts/report";
import { formatDate } from "@/utils/date";

const CATEGORY_LABELS: Record<ReportReason, string> = Object.fromEntries(
  REPORT_REASONS.map(({ value, label }) => [value, label]),
) as Record<ReportReason, string>;

function getCategoryLabel(category: ReportReason): string {
  return CATEGORY_LABELS[category] ?? category;
}

interface ReportListProps {
  reports: Report[];
  /** Present on the "open" tab; absent on "resolved", where items are read-only. */
  onResolve?: (report: Report) => void;
}

export function ReportList({ reports, onResolve }: ReportListProps) {
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const focusCardAt = (index: number) => {
    const target = itemRefs.current[index];
    target?.focus();
  };

  const handleItemKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowDown":
        if (index < reports.length - 1) {
          event.preventDefault();
          focusCardAt(index + 1);
        }
        break;
      case "ArrowUp":
        if (index > 0) {
          event.preventDefault();
          focusCardAt(index - 1);
        }
        break;
      case "Home":
        if (event.target === event.currentTarget && reports.length > 0) {
          event.preventDefault();
          focusCardAt(0);
        }
        break;
      case "End":
        if (event.target === event.currentTarget && reports.length > 0) {
          event.preventDefault();
          focusCardAt(reports.length - 1);
        }
        break;
    }
  };

  return (
    <ul aria-label="Lista de denúncias" className="space-y-4">
      {reports.map((report, index) => {
        const isResolved = report.resolvedAt !== null;
        const categoryLabel = getCategoryLabel(report.category);
        const headingId = `report-heading-${report.id}`;
        const hasDescription =
          report.description !== null && report.description.trim().length > 0;
        const reporterLabel = report.reporter
          ? report.reporter.fullName
          : "Conta removida";

        return (
          <li key={report.id}>
            <article
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              data-report-card
              tabIndex={0}
              aria-labelledby={headingId}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
              className="rounded-xl border border-gray-300 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B75BB]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isResolved
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 className="size-6" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-6" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h2
                      id={headingId}
                      className={`text-base font-semibold ${
                        isResolved ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {categoryLabel}
                    </h2>

                    <p className="text-sm text-gray-700 break-words leading-relaxed">
                      <span className="font-semibold text-gray-900">
                        Descrição:{" "}
                      </span>
                      {hasDescription ? (
                        report.description
                      ) : (
                        <span className="italic text-gray-500">
                          Sem descrição
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold text-white ${
                    isResolved ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {isResolved ? "Resolvida" : "Aberta"}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="font-semibold text-gray-800">
                      Ação denunciada:
                    </dt>
                    <dd>
                      <Link
                        to={`/activity/${report.activity.id}`}
                        className="font-medium text-[#1B75BB] hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B75BB]"
                      >
                        {report.activity.title}
                      </Link>
                    </dd>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="font-semibold text-gray-800">
                      Denunciado por:
                    </dt>
                    <dd className="text-gray-700">{reporterLabel}</dd>
                  </div>

                  {isResolved && report.resolvedAt && (
                    <div className="text-xs font-medium text-green-700 pt-0.5">
                      <dt className="sr-only">Status da resolução:</dt>
                      <dd>Resolvida em {formatDate(report.resolvedAt)}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                    {formatDate(report.createdAt)}
                  </span>

                  {onResolve && !isResolved && (
                    <button
                      type="button"
                      aria-describedby={headingId}
                      onClick={() => onResolve(report)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0055CC] hover:bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0055CC]"
                    >
                      <Check
                        className="size-3.5 stroke-[2.5]"
                        aria-hidden="true"
                      />
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
