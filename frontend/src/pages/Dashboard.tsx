import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { FeedSection } from "../features/dashboard/components/FeedSection";
import { Footer } from "../components/Footer";
import { PageTitle } from "../components/PageTitle";

interface DashboardProps {
  /** Tests pass 0 to skip fake timers; the UI keeps the typing debounce. */
  debounceMs?: number;
}

export function Dashboard({ debounceMs = 400 }: DashboardProps) {
  return (
    <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
      <PageTitle title="Ações" />
      <FeedSection debounceMs={debounceMs} />
    </DashboardShell>
  );
}
