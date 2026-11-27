import type { ActivityModeration } from "@/services/contracts/activity";
import { formatDate } from "@/utils";

interface ModerationNoticeProps {
  moderation: ActivityModeration;
}

/** What the author and managers see on top of an action moderation removed. */
export function ModerationNotice({ moderation }: ModerationNoticeProps) {
  return (
    <div
      role="status"
      className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-5 flex flex-col gap-2"
    >
      <p className="font-semibold">
        Esta ação foi removida pela moderação em{" "}
        {formatDate(moderation.removedAt)}.
      </p>
      {moderation.justification && (
        <p className="whitespace-pre-line">
          Justificativa: {moderation.justification}
        </p>
      )}
    </div>
  );
}
