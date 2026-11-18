import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { ActivityStatus, UserActivity } from "../types";
import { EnrolledCard } from "./cards/EnrolledCard";
import { CompletedCard } from "./cards/CompletedCard";
import { ManagedCard } from "./cards/ManagedCard";
import { fetchUserActivities } from "../services";
import { DEFAULT_ACTIVITY_STATUS, isActivityStatus } from "../constants";
import { useActionRegister } from "../../../hooks/useActionRegister";
import { EmptyActionsList } from "./EmptyActionsList";
import { Pagination } from "../../../components/Pagination";

const SUB_TAB_TITLES: Record<ActivityStatus, string> = {
  enrolled: "Atividades Inscritas",
  completed: "Atividades Concluídas",
  managed: "Atividades Gerenciadas",
};

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pagedSubTab, setPagedSubTab] = useState(activeSubTab);

  useEffect(() => {
    if (!filterParam || !isActivityStatus(filterParam)) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("filter", DEFAULT_ACTIVITY_STATUS);
          return next;
        },
        { replace: true },
      );
    }
  }, [filterParam, setSearchParams]);

  // The sub-tab lives in the URL, so it changes one render after the click
  // (or with no click at all, on browser Back). Resetting the page while
  // rendering, not in the click handler, keeps the old sub-tab from being
  // fetched again at page one before the new one arrives.
  if (pagedSubTab !== activeSubTab) {
    setPagedSubTab(activeSubTab);
    setPage(1);
    setTotalPages(1);
  }

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

  const selectPage = (nextPage: number) => {
    if (nextPage === page) return;

    setError(null);
    setIsLoading(true);
    setPage(nextPage);
  };

  const isManaged = activeSubTab === "managed";

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-[#000A1E]">
        {SUB_TAB_TITLES[activeSubTab]}
      </h1>

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
