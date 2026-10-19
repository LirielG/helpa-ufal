import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/services/apiError";
import type { CertificateValidation } from "@/services/contracts/certificate";
import { validateCertificate } from "./services";

export type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; certificate: CertificateValidation }
  | { status: "notFound" }
  | { status: "failed" };

/**
 * Validates `code` on mount, and again on `retry`. An empty code leaves the
 * state idle. Meant to be remounted (keyed) when the code changes, so an
 * answer for one code is never shown for another.
 *
 * Every other failure than a 404 (network, 401, 5xx) is `failed`, which the
 * screen offers to retry: it says nothing about the certificate itself.
 */
export function useCertificateValidation(code: string) {
  const [state, setState] = useState<ValidationState>(
    code ? { status: "loading" } : { status: "idle" },
  );
  const latestRequest = useRef(0);
  // Read synchronously so a second click lands before the re-render that
  // disables the button.
  const inFlight = useRef(false);

  const run = useCallback(() => {
    latestRequest.current += 1;
    const requestId = latestRequest.current;
    inFlight.current = true;

    const settle = (next: ValidationState) => {
      if (requestId !== latestRequest.current) return;
      inFlight.current = false;
      setState(next);
    };

    validateCertificate(code)
      .then((certificate) => settle({ status: "found", certificate }))
      .catch((error: unknown) =>
        settle({
          status:
            error instanceof ApiError && error.status === 404
              ? "notFound"
              : "failed",
        }),
      );
  }, [code]);

  useEffect(() => {
    if (!code) return;

    run();

    return () => {
      latestRequest.current += 1;
      inFlight.current = false;
    };
  }, [code, run]);

  const retry = useCallback(() => {
    if (!code || inFlight.current) return;
    setState({ status: "loading" });
    run();
  }, [code, run]);

  return { state, retry };
}
