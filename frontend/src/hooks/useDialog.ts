import { useEffect, useEffectEvent, useRef } from "react";

interface UseDialogOptions {
  onClose: () => void;
  closeDisabled?: boolean;
  getFallbackFocus?: () => HTMLElement | null;
}

export function useDialog({
  onClose,
  closeDisabled = false,
  getFallbackFocus,
}: UseDialogOptions) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !closeDisabled) {
      onClose();
    }
  });

  const restoreFocus = useEffectEvent(
    (previousActiveElement: Element | null) => {
      if (previousActiveElement instanceof HTMLElement) {
        if (previousActiveElement.isConnected) {
          previousActiveElement.focus();
        } else if (getFallbackFocus) {
          const fallback = getFallbackFocus();
          fallback?.focus();
        }
      }
    },
  );

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
      restoreFocus(previousActiveElement);
    };
  }, []);

  return dialogRef;
}
