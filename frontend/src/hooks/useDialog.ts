import { useEffect, useEffectEvent, useRef } from "react";

interface UseDialogOptions {
  onClose: () => void;
  closeDisabled?: boolean;
}

export function useDialog({
  onClose,
  closeDisabled = false,
}: UseDialogOptions) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !closeDisabled) onClose();
  });

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    const frame = requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement instanceof HTMLElement) {
        if (previousActiveElement.isConnected) {
          previousActiveElement.focus();
        } else {
          const cancelButton = Array.from(
            document.querySelectorAll<HTMLElement>("button:not(:disabled)"),
          ).find((btn) => btn.textContent?.includes("Cancelar inscrição"));

          if (cancelButton) {
            cancelButton.focus();
          } else {
            const mainTitle = document.querySelector<HTMLElement>("h1");
            mainTitle?.focus();
          }
        }
      }
    };
  }, []);

  return dialogRef;
}
