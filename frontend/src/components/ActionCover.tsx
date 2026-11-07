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
        <g stroke="white" strokeOpacity="0.12" strokeWidth="18">
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={i * 60 - 200} y1="200" x2={i * 60} y2="0" />
          ))}
        </g>
      )}
      {shape === "dots" && (
        <g fillOpacity="0.15">
          {Array.from({ length: 60 }, (_, i) => (
            <circle
              key={i}
              cx={(i % 12) * 36 + 10}
              cy={Math.floor(i / 12) * 44 + 12}
              r="4"
            />
          ))}
        </g>
      )}
    </svg>
  );
}

interface ActionCoverProps {
  id: string;
  type: ActivityType;
  title: string;
  className?: string;
  iconClassName?: string;
}

export function ActionCover({
  id,
  type,
  title,
  className = "",
  iconClassName = "size-14",
}: ActionCoverProps) {
  const { key, gradient, shape } = getActionCoverVariant(id);
  const [from, to] = gradient;
  const Icon = TYPE_ICONS[type] ?? Sparkles;

  return (
    <div
      role="img"
      aria-label={title}
      data-cover-variant={key}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
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
