import { useState, useMemo } from "react";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { HeroBanner } from "../features/dashboard/components/HeroBanner";
import { FilterBar } from "../features/dashboard/components/FilterBar";
import { ActionGrid } from "../features/dashboard/components/ActionGrid";
import { Footer } from "../components/Footer";
import bgDashboard from "../assets/bg.svg"; 
import { MOCK_ACTIONS } from "../features/dashboard/constants";
import type { FilterOptions } from "../features/dashboard/types";

export function Dashboard() {
  const [filters, setFilters] = useState<FilterOptions>({
    area: "all",
    actionType: "all",
    availability: "all",
  });

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredActions = useMemo(() => {
    return MOCK_ACTIONS.filter((action) => {
      if (filters.availability !== "all" && action.status !== filters.availability) {
        return false;
      }
      if (filters.actionType !== "all" && action.type !== filters.actionType) {
        return false;
      }
      return true;
    });
  }, [filters]);

  const dashboardBackgroundStyle = {
    backgroundImage: `url(${bgDashboard})`,
    backgroundPosition: "top center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };

  return (
    <DashboardShell
      header={<DashboardHeader />}
      footer={<Footer />} 
    >
      <HeroBanner />
      
      <div className="w-full bg-white" style={dashboardBackgroundStyle}>
        
        <div className="max-w-10xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          <FilterBar filters={filters} onFilterChange={handleFilterChange} />
          <ActionGrid actions={filteredActions} />
        </div>

      </div>
    </DashboardShell>
  );
}