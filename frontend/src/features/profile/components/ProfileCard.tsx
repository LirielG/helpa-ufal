import { useId } from "react";
import type { UserProfile } from "../types";
import { getInitials } from "../../../utils/helpers";

type ProfileCardProps = {
  user: UserProfile;
};

export function ProfileCard({ user }: ProfileCardProps) {
  const initials = getInitials(user.fullName) || "P";
  const hours = user.totalWorkloadHours;
  const counterCaptionId = useId();

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-[#1B75BB] text-white flex items-center justify-center font-bold text-xl shadow-sm shrink-0 overflow-hidden">
          {initials}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {user.fullName}
          </h2>
          <p className="text-sm text-gray-500">{user.email}</p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {user.course && (
              <span className="p-2 rounded-lg bg-[#61B1EF]/30 text-[#1B75BB] text-xs font-semibold">
                {user.course}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={counterCaptionId}
        className="shrink-0 text-center"
      >
        <div className="bg-[#ADF7F9] rounded-2xl px-6 py-4 min-w-22">
          <span className="block text-3xl font-bold leading-none text-[#002147]">
            {String(hours).padStart(2, "0")}
          </span>
          <span className="block text-[11px] font-medium text-[#002147] mt-1">
            {hours === 1 ? "hora" : "horas"}
          </span>
        </div>
        <p id={counterCaptionId} className="text-xs text-gray-500 mt-2">
          Total contribuído
        </p>
      </div>
    </section>
  );
}
