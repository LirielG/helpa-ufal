import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { ActivityStatus, UserActivity } from "../types";
import { EnrolledCard } from "./cards/EnrolledCard";
import { CompletedCard } from "./cards/CompletedCard";
import { ManagedCard } from "./cards/ManagedCard";
import { fetchUserActivities } from "../services";

const SUB_TABS: Array<{ id: ActivityStatus; label: string; empty: string }> = [
  {
    id: "enrolled",
    label: "Atividades Inscritas",
    empty: "Você não está inscrito em nenhuma ação no momento.",
  },
  {
    id: "completed",
    label: "Atividades Concluídas",
    empty: "Você ainda não concluiu nenhuma ação.",
  },
  {
    id: "managed",
    label: "Atividades Gerenciadas",
    empty: "Você ainda não criou nenhuma ação.",
  },
];

export function ActionsList() {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<ActivityStatus>("enrolled");
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A slower answer of the sub-tab the user just left must not overwrite
    // the one now on screen.
    let isCurrent = true;

    const loadActivities = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const list = await fetchUserActivities(activeSubTab);
        if (isCurrent) setActivities(list);
      } catch {
        if (isCurrent) {
          setError("Não foi possível carregar as atividades. Tente novamente.");
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    loadActivities();

    return () => {
      isCurrent = false;
    };
  }, [activeSubTab]);

  const handleEdit = (id: string) => navigate(`/activity/${id}/edit`);

  const handleManageEnrollments = (id: string) =>
    navigate(`/activity/${id}/enrollments`);

  // Clearing here, not in the effect, keeps the previous tab's items from
  // rendering for one frame with the new tab's cards and controls.
  const selectSubTab = (tab: ActivityStatus) => {
    if (tab === activeSubTab) return;
    setActivities([]);
    setIsLoading(true);
    setActiveSubTab(tab);
  };

  const removeActivity = (id: string) =>
    setActivities((current) => current.filter((item) => item.id !== id));

  const isManaged = activeSubTab === "managed";
  const emptyMessage = SUB_TABS.find((tab) => tab.id === activeSubTab)?.empty;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 border-b border-gray-200">
        {SUB_TABS.map((tab) => {
          const isActive = tab.id === activeSubTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectSubTab(tab.id)}
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
            <p className="text-gray-500 text-center py-8">{emptyMessage}</p>
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
                      onManageEnrollments={handleManageEnrollments}
                      onDelete={removeActivity}
                    />
                  );
                }
                return (
                  <EnrolledCard
                    key={activity.id}
                    activity={activity}
                    onCancelled={removeActivity}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
