import { useNavigate } from "react-router";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { HowItWorksSection } from "../features/home/components/HowItWorksSection";
import { Footer } from "../components/Footer";

export function HowItWorks() {
  const navigate = useNavigate();

  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <HowItWorksSection onExploreActions={() => navigate("/dashboard")} />
    </DashboardShell>
  );
}
