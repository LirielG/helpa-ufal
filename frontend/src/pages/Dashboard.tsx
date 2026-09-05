import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { HeroBanner } from "../features/dashboard/components/HeroBanner";
import { FilterBar } from "../features/dashboard/components/FilterBar";
import { ActionGrid } from "../features/dashboard/components/ActionGrid";
import { ActionRegister } from "../features/dashboard/components/ActionForm";
import { Footer } from "../components/Footer";
import bgDashboard from "../assets/bg.svg"; 
import { fetchActions } from "../features/dashboard/services";
import type { FilterOptions, Action } from "../features/dashboard/types";
import { Alert } from "../components/Alert";

export function Dashboard() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterOptions>({
    area: "all",
    actionType: "all",
    availability: "all",
  });

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadActions = useCallback(() => {
    setIsLoading(true);
    setError(null);

    fetchActions(filters)
      .then((res) => {
        setActions(res.activities);
      })
      .catch((err) => {
        console.error(err);
        setError("Não foi possível carregar as ações. Tente novamente.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [filters]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const dashboardBackgroundStyle = {
    backgroundImage: `url(${bgDashboard})`,
    backgroundPosition: "top center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };

  return (
    <DashboardShell
      header={<DashboardHeader onOpenRegister={() => setIsRegisterOpen(true)} />}
      footer={<Footer />}
    >
      <HeroBanner actions={actions} />
      
      <div className="w-full min-h-[50vh] bg-white" style={dashboardBackgroundStyle}>
        <div className="max-w-10xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          <FilterBar filters={filters} onFilterChange={handleFilterChange} />
          
          {isLoading && (
            <p className="text-center text-gray-500 py-10">Buscando ações...</p>
          )}

          {!isLoading && error && (
            <Alert type="error" message={error} />
          )}

          {!isLoading && !error && actions.length === 0 && (
            <p className="text-center text-gray-500 py-10">Nenhuma ação encontrada com esses filtros.</p>
          )}

          {!isLoading && !error && actions.length > 0 && (
            <ActionGrid actions={actions} />
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