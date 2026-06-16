import type { User } from "../../../types";

type ProfileCardProps = {
  user: User;
};

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-gray-200 overflow-hidden shrink-0">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              className="w-full h-full object-cover"
            />
          )}
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
            {user.institution && (
              <span className="p-2 rounded-lg bg-[#ADF7F9]/40 text-[#00A4A8] text-xs font-semibold">
                {user.institution}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-center">
        <div className="bg-[#ADF7F9] rounded-2xl px-6 py-4 min-w-22">
          <span className="block text-3xl font-bold leading-none text-[#002147]">
            {String(user.totalHours ?? 0).padStart(2, "0")}
          </span>
          <span className="block text-[11px] font-medium text-[#002147] mt-1">
            horas
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Total contribuído</p>
      </div>
    </section>
  );
}
