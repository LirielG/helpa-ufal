import { useState, useEffect } from "react";
import type { ActivityStatus, UserActivity } from "../types";
import { EnrolledCard } from "./cards/EnrolledCard";
import { CompletedCard } from "./cards/CompletedCard";
import { ManagedCard } from "./cards/ManagedCard";
import { fetchUserActivities } from "../services";

const SUB_TABS: Array<{ id: ActivityStatus; label: string }> = [
  { id: "enrolled", label: "Atividades Inscritas" },
  { id: "completed", label: "Atividades Concluídas" },
  { id: "managed", label: "Atividades Gerenciadas" },
];

export function ActionsList() {
  const [activeSubTab, setActiveSubTab] = useState<ActivityStatus>("enrolled");
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setIsLoading(true);
        setError(null);

        setActivities(await fetchUserActivities(activeSubTab));
      } catch {
        setError("Não foi possível carregar as atividades. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    loadActivities();
  }, [activeSubTab]);

  const handleEdit = (id: string) => {
    console.log(`Editar atividade ${id}`);
  };

  const isManaged = activeSubTab === "managed";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 border-b border-gray-200">
        {SUB_TABS.map((tab) => {
          const isActive = tab.id === activeSubTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 whitespace-nowrap px-4 py-3 -mb-px border-b-2 text-sm transition cursor-pointer ${
                isActive
                  ? "border-[#1B75BB] text-[#1B75BB] font-bold"
                  : "border-transparent text-gray-500 font-medium hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {isLoading && (
        <p className="text-gray-500 text-center py-8">
          Carregando atividades...
        </p>
      )}

      {!isLoading && error && (
        <p className="text-red-500 text-center py-8">{error}</p>
      )}

      {!isLoading && !error && (
        <>
          {activities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma atividade encontrada.
            </p>
          ) : (
            <div
              className={
                isManaged
                  ? "flex flex-col gap-4"
                  : "grid grid-cols-1 md:grid-cols-2 gap-4"
              }
            >
              {activities.map((activity) => {
                if (activeSubTab === "completed") {
                  return (
                    <CompletedCard key={activity.id} activity={activity} />
                  );
                }
                if (activeSubTab === "managed") {
                  return (
                    <ManagedCard
                      key={activity.id}
                      activity={activity}
                      onEdit={handleEdit}
                    />
                  );
                }
                return <EnrolledCard key={activity.id} activity={activity} />;
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
