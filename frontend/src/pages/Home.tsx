import { useState } from "react";
import {
  HomeHeader,
  type HomeTabId,
} from "../features/home/components/HomeHeader";
import { SobreSection } from "../features/home/components/SobreSection";
import { ComoFuncionaSection } from "../features/home/components/ComoFuncionaSection";
import { AcoesSection } from "../features/home/components/AcoesSection";
import { Footer } from "../components/Footer";

export function Home() {
  const [activeTab, setActiveTab] = useState<HomeTabId>("sobre");

  const handleSelectTab = (tab: HomeTabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <HomeHeader activeTab={activeTab} onSelectTab={handleSelectTab} />

      <main className="flex-1 flex flex-col">
        {activeTab === "sobre" && <SobreSection />}
        {activeTab === "como-funciona" && (
          <ComoFuncionaSection onExploreActions={() => handleSelectTab("acoes")} />
        )}
        {activeTab === "acoes" && <AcoesSection />}
      </main>

      <Footer />
    </div>
  );
}
