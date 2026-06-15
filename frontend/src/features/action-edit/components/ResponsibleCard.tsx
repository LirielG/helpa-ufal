import type { Responsible } from "../types";

interface ResponsibleCardProps {
  responsible: Responsible;
}

export function ResponsibleCard({ responsible }: ResponsibleCardProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-700">Responsável</label>
      <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl">
        <div className="size-14 rounded-full overflow-hidden shrink-0 bg-gray-100">
          {responsible.avatarUrl ? (
            <img
              src={responsible.avatarUrl}
              alt={responsible.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-semibold text-lg">
              {responsible.name.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">{responsible.name}</p>
          <p className="text-sm text-gray-500">{responsible.email}</p>
        </div>
      </div>
    </div>
  );
}