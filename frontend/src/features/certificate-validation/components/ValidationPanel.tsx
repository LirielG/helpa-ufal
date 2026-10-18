import { useRef } from "react";
import { useNavigate } from "react-router";
import { useCertificateValidation } from "../useCertificateValidation";
import { ValidationForm } from "./ValidationForm";
import { ValidationResult } from "./ValidationResult";

interface ValidationPanelProps {
  /** The code from the URL, possibly empty. Key the panel by it. */
  code: string;
}

export function ValidationPanel({ code }: ValidationPanelProps) {
  const navigate = useNavigate();
  const { state, retry } = useCertificateValidation(code);
  // The panel remounts on the new URL, which resets this; until then a second
  // click would push the same entry onto the history again.
  const navigating = useRef(false);

  const handleSubmit = (submitted: string) => {
    // Same code as the URL: navigating would not change the route, so
    // validate again in place.
    if (submitted === code) {
      retry();
      return;
    }

    if (navigating.current) return;
    navigating.current = true;

    // The result gets a shareable link.
    navigate(`/validar/${encodeURIComponent(submitted)}`);
  };

  return (
    <div className="space-y-6">
      <ValidationForm
        initialCode={code}
        isLoading={state.status === "loading"}
        onSubmit={handleSubmit}
      />

      <div aria-live="polite">
        <ValidationResult state={state} onRetry={retry} />
      </div>
    </div>
  );
}
