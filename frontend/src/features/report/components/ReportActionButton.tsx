import { useId } from "react";

type ReportActionButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function ReportActionButton({
  onClick,
  disabled = false,
  className = "",
}: ReportActionButtonProps) {
  const maskId = useId();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Denunciar ação"
      title="Denunciar ação"
      className={[
        "inline-flex h-8 w-8 items-center justify-center cursor-pointer",
        "transition-transform duration-200 hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-red-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="#ffffff" />
            <rect x="11" y="8" width="2" height="7" rx="1" fill="#000000" />
            <circle cx="12" cy="18" r="1.2" fill="#000000" />
          </mask>
        </defs>
        <path
          d="M12 2L1.7 20.5C1.4 21.1 1.9 22 2.6 22H21.4C22.1 22 22.6 21.1 22.3 20.5L12 2Z"
          fill="#ff5b5b"
          mask={`url(#${maskId})`}
        />
      </svg>
    </button>
  );
}