import type { Action } from "../types";
import { ActionCard } from "./ActionCard";

interface ActionGridProps {
  actions: Action[];
}

export function ActionGrid({ actions }: ActionGridProps) {
  if (actions.length === 0) {
    return (
      <div className="w-full py-12 text-center">
        <p className="text-gray-500 text-lg">Nenhuma ação encontrada</p>
        <p className="text-gray-400 text-sm mt-2">Tente ajustar os filtros</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
    </div>
  );
}