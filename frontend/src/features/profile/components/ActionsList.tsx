import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { ActivityStatus, UserActivity } from "../types";
import { EnrolledCard } from "./cards/EnrolledCard";
import { CompletedCard } from "./cards/CompletedCard";
import { ManagedCard } from "./cards/ManagedCard";
import { fetchUserActivities } from "../services";
import {
  DEFAULT_ACTIVITY_STATUS,
  PROFILE_SUB_TABS,
  isActivityStatus,
} from "../constants";
import { useActionRegister } from "../../../hooks/useActionRegister";
import { EmptyActionsList } from "./EmptyActionsList";

export function ActionsList() {
  const navigate = useNavigate();
  const { openRegisterModal, setOnSuccessCallback } = useActionRegister();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const activeSubTab: ActivityStatus = isActivityStatus(filterParam)
    ? filterParam
    : DEFAULT_ACTIVITY_STATUS;
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reloadActivities = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    // A slower answer of the sub-tab the user just left must not overwrite
    // the one now on screen.
    let isCurrent = true;

    const load = async () => {
      try {
        const list = await fetchUserActivities(activeSubTab);
        if (isCurrent) {
          setActivities(list);
          setError(null);
        }
      } catch {
        if (isCurrent) {
          setError("Não foi possível carregar as atividades. Tente novamente.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCurrent = false;
    };
  }, [activeSubTab, reloadCount]);

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
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (tab === DEFAULT_ACTIVITY_STATUS) next.delete("filter");
        else next.set("filter", tab);
        return next;
      },
      { replace: true },
    );
  };

  const removeActivity = (id: string) =>
    setActivities((current) => current.filter((item) => item.action.id !== id));

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
        <p className="text-red-500 text-center py-8">{error}</p>
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
                      onDelete={removeActivity}
                    />
                  );
                }
                return (
                  <EnrolledCard
                    key={activity.action.id}
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
