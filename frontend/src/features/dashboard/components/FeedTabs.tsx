export type FeedKey = "helpa" | "sigaa";

interface FeedTabsProps {
  active: FeedKey;
  onChange: (feed: FeedKey) => void;
  /** Tints the active SIGAA tab when that feed failed to load. */
  sigaaHasError?: boolean;
}

const TABS: Array<{ id: FeedKey; label: string }> = [
  { id: "helpa", label: "Helpa" },
  { id: "sigaa", label: "SIGAA" },
];

export function FeedTabs({ active, onChange, sigaaHasError }: FeedTabsProps) {
  return (
    <div role="tablist" aria-label="Origem das ações" className="flex w-full">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const warn = isActive && tab.id === "sigaa" && sigaaHasError;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 px-6 py-3.5 text-sm font-semibold transition-colors cursor-pointer border-b-2 ${
              isActive
                ? `bg-white text-gray-900 ${warn ? "border-yellow-500" : "border-[#1B75BB]"}`
                : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
