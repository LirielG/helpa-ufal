import { useState } from "react";
import { useLocation } from "react-router";
import {
  HomeHeader,
  type HomeTabId,
} from "../features/home/components/HomeHeader";
import { AboutSection } from "../features/home/components/AboutSection";
import { HowItWorksSection } from "../features/home/components/HowItWorksSection";
import { FeedSection } from "../features/dashboard/components/FeedSection";
import { Footer } from "../components/Footer";

export function Home() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<HomeTabId>(() =>
    location.hash === "#como-funciona" ? "how-it-works" : "about",
  );
  const [trackedHash, setTrackedHash] = useState(location.hash);

  if (trackedHash !== location.hash) {
    setTrackedHash(location.hash);
    if (location.hash === "#como-funciona") {
      setActiveTab("how-it-works");
    }
  }

  const handleSelectTab = (tab: HomeTabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <HomeHeader activeTab={activeTab} onSelectTab={handleSelectTab} />

      <main className="flex-1 flex flex-col">
        {activeTab === "about" && <AboutSection />}
        {activeTab === "how-it-works" && (
          <HowItWorksSection
            onExploreActions={() => handleSelectTab("actions")}
          />
        )}
        {activeTab === "actions" && <FeedSection />}
      </main>

      <Footer />
    </div>
  );
}
