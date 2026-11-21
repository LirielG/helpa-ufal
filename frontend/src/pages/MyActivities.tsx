import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { ActionsList } from "../features/profile/components/ActionsList";
import bgDashboard from "../assets/bg.svg";

export function MyActivities() {
  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <div
        className="w-full flex-1"
        style={{
          backgroundImage: `url(${bgDashboard})`,
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <ActionsList />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
