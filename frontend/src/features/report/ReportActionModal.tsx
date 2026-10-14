import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, X } from "lucide-react";
import { Alert, Button, Textarea } from "../../components";
import { ApiError } from "../../services/apiError";
import { REPORT_REASONS } from "./constants/reportReasons";
import {
  REPORT_DESCRIPTION_MAX_LENGTH,
  reportSchema,
  type ReportFormValues,
} from "./schemas/reportSchema";
import { reportAction } from "./services";
import { getReportErrorMessage, isRetryableReportError } from "./errors";

type ReportActionModalProps = {
  open: boolean;
  actionId: string;
  onClose: () => void;
  /** Called once the API holds a report from this user: on 201, and on 409. */
  onReported?: () => void;
};

type SubmitError = {
  message: string;
  canRetry: boolean;
};

const UNEXPECTED_ERROR_MESSAGE =
  "Não foi possível registrar a denúncia. Tente novamente.";

/**
 * Mounting the dialog only while open means closing it discards the form, the
 * success step and any error, so reopening always starts clean.
 */
export function ReportActionModal({ open, ...props }: ReportActionModalProps) {
  return open ? <ReportActionDialog {...props} /> : null;
}

function ReportActionDialog({
  actionId,
  onClose,
  onReported,
}: Omit<ReportActionModalProps, "open">) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State updates land after the next render, so a fast double click would
  // still see isSubmitting as false; the ref closes that window.
  const submittingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      description: "",
    },
    mode: "onChange",
  });

  const descriptionLength =
    useWatch({ control, name: "description" })?.length ?? 0;

  useEffect(() => {
    previousActiveElement.current =
      document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    requestAnimationFrame(() => {
      const firstFocusable = rootRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus?.();
    };
  }, [onClose]);

  const submitForm = async ({ category, description }: ReportFormValues) => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // The API rejects an empty description, so a blank one is left out.
      await reportAction(actionId, {
        category,
        ...(description ? { description } : {}),
      });
      setStep("success");
      onReported?.();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setSubmitError({ message: UNEXPECTED_ERROR_MESSAGE, canRetry: true });
        return;
      }

      if (error.status === 409) {
        onReported?.();
      }

      const message = getReportErrorMessage(error);
      if (message !== null) {
        setSubmitError({ message, canRetry: isRetryableReportError(error) });
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isBlocked = submitError !== null && !submitError.canRetry;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="bg-[#ff5b5b] px-6 py-5 text-center text-white">
          <div className="relative">
            <h2 id="report-modal-title" className="text-2xl font-semibold">
              Denúncia de Ação
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 rounded-full p-1.5 text-white/90 transition hover:bg-white/15 hover:text-white"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {step === "success" ? (
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <CheckCircle
              className="size-12 text-green-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-xl font-semibold text-gray-900">
                Denúncia registrada
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Obrigado por avisar. A equipe vai analisar a ação.
              </p>
            </div>
            <Button
              type="button"
              variant="navy"
              size="lg"
              className="rounded-full px-8 py-3"
              onClick={onClose}
            >
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={(event) => handleSubmit(submitForm)(event)}>
            <div className="space-y-6 px-6 py-6">
              {submitError ? (
                <Alert type="error" message={submitError.message} />
              ) : null}

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-gray-900">
                  Qual o motivo da denúncia?
                </legend>

                <div className="space-y-2">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-sm text-gray-700 transition hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        value={reason.value}
                        className="size-4 cursor-pointer accent-[#072C59]"
                        {...register("category")}
                      />
                      {reason.label}
                    </label>
                  ))}
                </div>

                {errors.category?.message ? (
                  <p className="text-sm text-red-500">
                    {errors.category.message}
                  </p>
                ) : null}
              </fieldset>

              <div>
                <Textarea
                  label="Descreva o motivo (opcional)"
                  placeholder="Digite aqui o motivo do qual está denunciando a ação"
                  rows={5}
                  error={errors.description?.message}
                  {...register("description")}
                />
                <p className="mt-1 text-right text-xs text-gray-500">
                  {descriptionLength}/{REPORT_DESCRIPTION_MAX_LENGTH}
                </p>
              </div>
            </div>

            <div className="flex gap-4 px-6 pb-6">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1 rounded-full px-8 py-3"
                onClick={onClose}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                variant="navy"
                size="lg"
                className="flex-1 rounded-full px-8 py-3"
                isLoading={isSubmitting}
                disabled={!isValid || isSubmitting || isBlocked}
              >
                {submitError?.canRetry ? "Tentar novamente" : "Denunciar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
