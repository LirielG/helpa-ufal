import { ArrowLeft } from "lucide-react";
import { ActionCover } from "@/components/ActionCover";
import type { ActivityType } from "@/services/contracts/activity";

interface ActionHeroProps {
  actionId: string;
  type: ActivityType;
  category: string;
  title: string;
  shortDescription: string;
  onBack: () => void;
}

export function ActionHero({
  actionId,
  type,
  category,
  title,
  onBack,
}: ActionHeroProps) {
  return (
    <div className="relative w-full h-[55vh] min-h-80 flex flex-col justify-end">
      <ActionCover
        id={actionId}
        type={type}
        title={title}
        className="absolute inset-0"
        iconClassName="size-32"
      />

      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/30 to-black/70" />

      <div className="relative z-10 px-6 pb-8 max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-white/90 hover:text-white text-sm mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>

        <span className="inline-block bg-[#1B75BB] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
          {category}
        </span>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          {title}
        </h1>
      </div>
    </div>
  );
}
