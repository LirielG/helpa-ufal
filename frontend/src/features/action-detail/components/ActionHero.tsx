import type { RefObject } from "react";
import { ActionCover } from "@/components/ActionCover";
import { BackLink } from "@/components/BackLink";
import type { ActivityType } from "@/services/contracts/activity";

interface ActionHeroProps {
  actionId: string;
  type: ActivityType;
  category: string;
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
}

export function ActionHero({
  actionId,
  type,
  category,
  title,
  titleRef,
}: ActionHeroProps) {
  return (
    <div className="relative w-full min-h-[clamp(16rem,35vh,24rem)] flex flex-col justify-end">
      {/* No title: the <h1> below already names the action. */}
      <div className="absolute inset-0">
        <ActionCover
          id={actionId}
          type={type}
          className="w-full h-full"
          iconClassName="size-24"
          iconPlacement="top-right"
        />
      </div>

      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/30 to-black/70" />

      <div className="relative z-10 page-container pt-6 pb-8">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <BackLink variant="light" />
            <span className="inline-block bg-[#1B75BB] text-white text-xs font-semibold px-3 py-1 rounded-full">
              {category}
            </span>
          </div>

          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl md:text-4xl font-bold text-white mb-2"
          >
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
