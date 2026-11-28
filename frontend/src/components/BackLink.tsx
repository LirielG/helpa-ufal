import type { MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";

export interface BackLinkProps {
  label?: string;
  fallbackTo?: string;
  variant?: "default" | "light";
  onClick?: () => void;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BackLinkProps["variant"]>, string> = {
  default:
    "text-[#00579A] hover:text-[#00447a] focus-visible:outline-[#00579A]",
  light: "text-white/90 hover:text-white focus-visible:outline-white",
};

export function BackLink({
  label = "Voltar",
  fallbackTo = "/dashboard",
  variant = "default",
  onClick,
  className = "",
}: BackLinkProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const displayLabel = label.startsWith("←") ? label : `← ${label}`;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (onClick) {
      event.preventDefault();
      onClick();
      return;
    }

    // BrowserRouter stores a monotonic idx in history.state (0 on direct entry,
    // even with external browser history or replace redirects). MemoryRouter
    // leaves history.state null, so location.key !== "default" serves as fallback.
    const historyIdx = (window.history.state as { idx?: unknown } | null)?.idx;
    const hasInternalHistory =
      typeof historyIdx === "number"
        ? historyIdx > 0
        : location.key !== "default";

    event.preventDefault();
    if (hasInternalHistory) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <Link
      to={fallbackTo}
      onClick={handleClick}
      className={`inline-flex items-center text-sm font-medium hover:underline underline-offset-4 transition-colors rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {displayLabel}
    </Link>
  );
}
