import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { HeroBanner } from "../features/dashboard/components/HeroBanner";
import {
  FeedTabs,
  type FeedKey,
} from "../features/dashboard/components/FeedTabs";
import { HelpaFeed } from "../features/dashboard/components/HelpaFeed";
import { ActionRegister } from "../features/dashboard/components/ActionForm";
import { SigaaFeed } from "../features/sigaa/components/SigaaFeed";
import { Footer } from "../components/Footer";
import bgDashboard from "../assets/bg.svg";
import { fetchActions } from "../features/dashboard/services";
import type { FilterOptions, Action } from "../features/dashboard/types";

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const feed: FeedKey =
    searchParams.get("feed") === "sigaa" ? "sigaa" : "helpa";

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sigaaHasError, setSigaaHasError] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    area: "all",
    actionType: "all",
    availability: "all",
  });

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const changeFeed = useCallback(
    (next: FeedKey) => {
      setSigaaHasError(false);
      setSearchParams(next === "sigaa" ? { feed: "sigaa" } : {});
    },
    [setSearchParams],
  );

  const showHelpaFeed = useCallback(() => changeFeed("helpa"), [changeFeed]);

  const loadActions = useCallback(() => {
    setIsLoading(true);
    setError(null);

    fetchActions(filters, page)
      .then((res) => {
        setActions(res.activities);
        setTotalPages(Math.max(1, res.totalPages ?? 1));
      })
      .catch((err) => {
        console.error(err);
        setError("Não foi possível carregar as ações. Tente novamente.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [filters, page]);

  useEffect(() => {
    let mounted = true;

    const fetchOnMount = async () => {
      if (mounted) {
        await loadActions();
      }
    };

    fetchOnMount();

    return () => {
      mounted = false;
    };
  }, [loadActions]);

  const dashboardBackgroundStyle = {
    backgroundImage: `url(${bgDashboard})`,
    backgroundPosition: "top center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };

  return (
    <DashboardShell
      header={
        <DashboardHeader onOpenRegister={() => setIsRegisterOpen(true)} />
      }
      footer={<Footer />}
    >
      <HeroBanner actions={actions} />

      <div
        className="w-full min-h-[50vh] bg-white"
        style={dashboardBackgroundStyle}
      >
        <div className="max-w-10xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          <FeedTabs
            active={feed}
            onChange={changeFeed}
            sigaaHasError={sigaaHasError}
          />

          {feed === "helpa" ? (
            <HelpaFeed
              actions={actions}
              filters={filters}
              onFilterChange={handleFilterChange}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            <SigaaFeed
              onExploreHelpa={showHelpaFeed}
              onErrorChange={setSigaaHasError}
            />
          )}
        </div>
      </div>

      <ActionRegister
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={loadActions}
      />
    </DashboardShell>
  );
}
