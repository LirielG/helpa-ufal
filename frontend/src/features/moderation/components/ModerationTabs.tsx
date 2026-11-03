import { useRef, type KeyboardEvent } from "react";
import type { ModerationTab } from "../useModerationReports";

interface ModerationTabsProps {
  activeTab: ModerationTab;
  onChange: (tab: ModerationTab) => void;
  panelId: string;
}

const TABS: ReadonlyArray<{ id: ModerationTab; label: string }> = [
  { id: "open", label: "Em aberto" },
  { id: "resolved", label: "Resolvidas" },
];

export function ModerationTabs({
  activeTab,
  onChange,
  panelId,
}: ModerationTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveToIndex = (index: number) => {
    const next = TABS[index];
    if (!next) return;
    tabRefs.current[index]?.focus();
    onChange(next.id);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        moveToIndex((index + 1) % TABS.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveToIndex((index - 1 + TABS.length) % TABS.length);
        break;
      case "Home":
        event.preventDefault();
        moveToIndex(0);
        break;
      case "End":
        event.preventDefault();
        moveToIndex(TABS.length - 1);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Status das denúncias"
      className="flex border-b border-gray-200"
    >
      {TABS.map((tab, index) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`moderation-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex-1 sm:flex-initial px-6 py-3.5 -mb-px text-sm font-semibold border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1B75BB] ${
              isActive
                ? "border-[#1B75BB] text-[#072C59]"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
