import { useId } from "react";
import {
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType } from "@/services/contracts/activity";
import {
  getActionCoverVariant,
  type ActionCoverShape,
} from "@/utils/actionCover";

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  EXTENSION: HeartHandshake,
  COURSE: GraduationCap,
  EVENT: CalendarDays,
  LECTURE: Presentation,
  OTHER: Sparkles,
};

function CoverShapeLayer({ shape }: { shape: ActionCoverShape }) {
  // A page can hold many covers, so repeated marks use an SVG <pattern>
  // (one node) instead of one element per mark; useId keeps each pattern id
  // unique on the page.
  const patternId = useId();

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      fill="white"
    >
      {shape === "circles" && (
        <g fillOpacity="0.12">
          <circle cx="340" cy="30" r="110" />
          <circle cx="60" cy="190" r="80" />
          <circle cx="210" cy="100" r="40" />
        </g>
      )}
      {shape === "waves" && (
        <g fillOpacity="0.12">
          <path d="M0 130 C100 90 200 170 400 110 V200 H0 Z" />
          <path d="M0 160 C120 130 260 200 400 150 V200 H0 Z" />
        </g>
      )}
      {shape === "stripes" && (
        <>
          <pattern
            id={patternId}
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="18" height="60" fillOpacity="0.12" />
          </pattern>
          <rect width="400" height="200" fill={`url(#${patternId})`} />
        </>
      )}
      {shape === "dots" && (
        <>
          <pattern
            id={patternId}
            width="36"
            height="44"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="12" r="4" fillOpacity="0.15" />
          </pattern>
          <rect width="400" height="200" fill={`url(#${patternId})`} />
        </>
      )}
    </svg>
  );
}

const ICON_PLACEMENT = {
  center: "items-center justify-center",
  // Keeps the icon clear of content laid over the bottom of the cover.
  "top-right": "items-start justify-end p-8",
} as const;

interface ActionCoverProps {
  id: string;
  type: ActivityType;
  /** Accessible name. Omit it when the title is already shown next to the
   * cover, which makes the cover decorative and hidden from screen readers. */
  title?: string;
  className?: string;
  iconClassName?: string;
  iconPlacement?: keyof typeof ICON_PLACEMENT;
}

export function ActionCover({
  id,
  type,
  title,
  className = "",
  iconClassName = "size-14",
  iconPlacement = "center",
}: ActionCoverProps) {
  const { key, gradient, shape } = getActionCoverVariant(id);
  const [from, to] = gradient;
  const Icon = TYPE_ICONS[type] ?? Sparkles;
  const accessibility = title
    ? { "aria-label": title }
    : { "aria-hidden": true as const };

  return (
    <div
      role="img"
      {...accessibility}
      data-cover-variant={key}
      className={`relative overflow-hidden flex ${ICON_PLACEMENT[iconPlacement]} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <CoverShapeLayer shape={shape} />
      <Icon
        aria-hidden="true"
        className={`relative text-white/80 ${iconClassName}`}
      />
    </div>
  );
}
