import { HomeHeader } from "../features/home/components/HomeHeader";
import { AboutSection } from "../features/home/components/AboutSection";
import { Footer } from "../components/Footer";
import { PageTitle } from "../components/PageTitle";

export function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      <PageTitle title="Sobre o Projeto" />
      <HomeHeader />

      <main className="flex-1 flex flex-col">
        <AboutSection />
      </main>

      <Footer />
    </div>
  );
}
