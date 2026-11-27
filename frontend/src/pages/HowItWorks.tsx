import { useNavigate } from "react-router";
import { HomeHeader } from "../features/home/components/HomeHeader";
import { HowItWorksSection } from "../features/home/components/HowItWorksSection";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import { useAuth } from "../hooks/useAuth";
import { PageTitle } from "../components/PageTitle";

export function HowItWorks() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const section = (
    <HowItWorksSection onExploreActions={() => navigate("/dashboard")} />
  );

  // A signed-in user reaches this page from Ajuda and keeps the sidebar; the
  // page only explains, so it has no shortcut to create an action.
  if (isAuthenticated) {
    return (
      <DashboardShell
        header={<DashboardHeader />}
        footer={<Footer />}
        showCreateAction={false}
      >
        <PageTitle title="Como Funciona" />
        {section}
      </DashboardShell>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <PageTitle title="Como Funciona" />
      <HomeHeader />

      <main className="flex-1 flex flex-col">{section}</main>

      <Footer />
    </div>
  );
}
