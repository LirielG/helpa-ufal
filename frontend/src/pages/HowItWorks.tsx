import { useNavigate } from "react-router";
import { HomeHeader } from "../features/home/components/HomeHeader";
import { HowItWorksSection } from "../features/home/components/HowItWorksSection";
import { useDashboardShellOptions } from "../features/dashboard/components/DashboardShellContext";
import { Footer } from "../components/Footer";
import { useAuth } from "../hooks/useAuth";
import { PageTitle } from "../components/PageTitle";

export function HowItWorks() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // The page only explains, so it has no shortcut to create an action.
  useDashboardShellOptions({ showCreateAction: false });

  const section = (
    <HowItWorksSection onExploreActions={() => navigate("/dashboard")} />
  );

  // A signed-in user reaches this page from Ajuda, inside the dashboard
  // shell; a visitor gets the institutional layout, which the shell leaves to
  // the page.
  if (isAuthenticated) {
    return (
      <>
        <PageTitle title="Como Funciona" />
        {section}
      </>
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
