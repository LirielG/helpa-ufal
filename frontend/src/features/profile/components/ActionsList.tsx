import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { ActivityStatus, UserActivity } from "../types";
import { EnrolledCard } from "./cards/EnrolledCard";
import { CompletedCard } from "./cards/CompletedCard";
import { ManagedCard } from "./cards/ManagedCard";
import { fetchUserActivities } from "../services";
import { PROFILE_SUB_TABS } from "../constants";
import { useActionRegister } from "../../../hooks/useActionRegister";
import { EmptyActionsList } from "./EmptyActionsList";
import { Pagination } from "../../../components/Pagination";

export function ActionsList() {
  const navigate = useNavigate();
  const { openRegisterModal, setOnSuccessCallback } = useActionRegister();
  const [activeSubTab, setActiveSubTab] = useState<ActivityStatus>("enrolled");
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const reloadActivities = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    // Abandoned requests must not change the current page, error, or loading.
    let isCurrent = true;

    const load = async () => {
      try {
        const list = await fetchUserActivities(activeSubTab, page);

        if (isCurrent) {
          if (list.items.length === 0 && page > 1) {
            setPage(page - 1);
            return;
          }

          setActivities(list.items);
          setTotalPages(list.totalPages);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        if (isCurrent) {
          setError("Não foi possível carregar as atividades. Tente novamente.");
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCurrent = false;
    };
  }, [activeSubTab, page, reloadCount]);

  useEffect(() => {
    if (activeSubTab === "managed") {
      setOnSuccessCallback(reloadActivities);

      return () => {
        setOnSuccessCallback(undefined);
      };
    }
  }, [activeSubTab, setOnSuccessCallback, reloadActivities]);

  const handleEdit = (id: string) => navigate(`/activity/${id}/edit`);

  const handleManageEnrollments = (id: string) =>
    navigate(`/activity/${id}/enrollments`);

  // Clearing here, not in the effect, keeps the previous tab's items from
  // rendering for one frame with the new tab's cards and controls.
  const selectSubTab = (tab: ActivityStatus) => {
    if (tab === activeSubTab) return;

    setActivities([]);
    setError(null);
    setIsLoading(true);
    setPage(1);
    setTotalPages(1);
    setActiveSubTab(tab);
  };

  const selectPage = (nextPage: number) => {
    if (nextPage === page) return;

    setError(null);
    setIsLoading(true);
    setPage(nextPage);
  };

  const isManaged = activeSubTab === "managed";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 border-b border-gray-200">
        {PROFILE_SUB_TABS.map((tab) => {
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
        <div className="text-center py-8 space-y-4">
          <p role="alert" className="text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={reloadActivities}
            className="px-4 py-2 rounded-lg bg-[#1B75BB] text-white text-sm font-medium hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B75BB] transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {activities.length === 0 ? (
            <EmptyActionsList
              subTab={activeSubTab}
              onNavigate={(route) => navigate(route)}
              onOpenRegisterModal={openRegisterModal}
            />
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
                    <CompletedCard
                      key={activity.action.id}
                      activity={activity}
                    />
                  );
                }

                if (activeSubTab === "managed") {
                  return (
                    <ManagedCard
                      key={activity.action.id}
                      activity={activity}
                      onEdit={handleEdit}
                      onManageEnrollments={handleManageEnrollments}
                      onDelete={reloadActivities}
                    />
                  );
                }

                return (
                  <EnrolledCard
                    key={activity.action.id}
                    activity={activity}
                    onCancelled={reloadActivities}
                  />
                );
              })}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={selectPage}
          />
        </>
      )}
    </div>
  );
}
