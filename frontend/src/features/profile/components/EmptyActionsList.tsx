import { EMPTY_STATE_CONFIGS } from "../constants";
import type { ActivityStatus } from "../types";

interface EmptyActionsListProps {
  subTab: ActivityStatus;
  onNavigate: (route: string) => void;
  onOpenRegisterModal: () => void;
}

export function EmptyActionsList({
  subTab,
  onNavigate,
  onOpenRegisterModal,
}: EmptyActionsListProps) {
  const config = EMPTY_STATE_CONFIGS[subTab];

  if (!config) return null;

  const handleClick = () => {
    if (config.actionType === "navigate" && config.targetRoute) {
      onNavigate(config.targetRoute);
    } else if (config.actionType === "register_modal") {
      onOpenRegisterModal();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 space-y-4">
      <p className="text-gray-600 text-sm md:text-base max-w-md">
        {config.text}
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer"
        style={{ backgroundColor: "#00579A" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#004377";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#00579A";
        }}
      >
        {config.buttonLabel}
      </button>
    </div>
  );
}
