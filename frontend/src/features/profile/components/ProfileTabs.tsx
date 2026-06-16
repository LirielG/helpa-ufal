import type { ProfileTab } from "../types";

type ProfileTabsProps = {
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
};

const TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: "personal", label: "Dados Pessoais" },
  { id: "certificates", label: "Certificados" },
  { id: "actions", label: "Ações" },
];

export function ProfileTabs({ activeTab, onChange }: ProfileTabsProps) {
  return (
    <nav className="bg-white rounded-2xl shadow-sm p-2 flex flex-col gap-1">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`w-full text-left px-4 py-3.5 rounded-xl font-semibold transition cursor-pointer ${
              isActive
                ? "bg-[#072C59] text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
