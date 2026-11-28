import { FeedSection } from "../features/dashboard/components/FeedSection";
import { PageTitle } from "../components/PageTitle";

interface DashboardProps {
  /** Tests pass 0 to skip fake timers; the UI keeps the typing debounce. */
  debounceMs?: number;
}

export function Dashboard({ debounceMs = 400 }: DashboardProps) {
  return (
    <>
      <PageTitle title="Ações" />
      <FeedSection debounceMs={debounceMs} />
    </>
  );
}
