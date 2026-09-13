import { ExternalLink } from "lucide-react";
import { sigaaDetailUrl } from "../constants";
import type { SigaaActivity } from "../types";

interface SigaaActivityRowProps {
  activity: SigaaActivity;
}

export function SigaaActivityRow({ activity }: SigaaActivityRowProps) {
  const detailUrl = sigaaDetailUrl(activity.sigaaId);

  return (
    <li className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex flex-col gap-2">
        <h3 className="text-base font-bold text-gray-900">{activity.title}</h3>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {activity.type}
          </span>
          {activity.department && (
            <>
              <span aria-hidden="true" className="text-gray-300">
                •
              </span>
              <span>{activity.department}</span>
            </>
          )}
        </div>
      </div>

      {detailUrl && (
        <a
          href={detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-[#072C59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3d78]"
        >
          Ver no SIGAA
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      )}
    </li>
  );
}
