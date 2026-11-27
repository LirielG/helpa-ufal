import { useNavigate } from "react-router";
import { HomeHeader } from "../features/home/components/HomeHeader";
import { HowItWorksSection } from "../features/home/components/HowItWorksSection";
import { Footer } from "../components/Footer";

export function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <HomeHeader />

      <main className="flex-1 flex flex-col">
        <HowItWorksSection onExploreActions={() => navigate("/dashboard")} />
      </main>

      <Footer />
    </div>
  );
}
