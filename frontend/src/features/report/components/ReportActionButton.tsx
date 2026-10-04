import { useId } from "react";

type ReportActionButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /**
   * The user has already reported this action. Uses aria-disabled rather than
   * disabled so the button stays focusable: the modal returns focus to it on
   * close, and a disabled button would drop focus to <body>.
   */
  reported?: boolean;
  className?: string;
};

export function ReportActionButton({
  onClick,
  disabled = false,
  reported = false,
  className = "",
}: ReportActionButtonProps) {
  const maskId = useId();

  return (
    <button
      type="button"
      onClick={reported ? undefined : onClick}
      disabled={disabled}
      aria-disabled={reported || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1 cursor-pointer",
        "text-sm font-medium text-[#d93636] transition hover:underline",
        "focus:outline-none focus:ring-2 focus:ring-red-200",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline",
        "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:no-underline",
        className,
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
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
      {reported ? "Ação denunciada" : "Denunciar ação"}
    </button>
  );
}
