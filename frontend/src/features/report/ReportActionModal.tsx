import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Button, Checkbox, Textarea } from "../../components";
import { REPORT_REASONS, type ReportReasonValue } from "./constants/reportReasons";
import { reportSchema, type ReportFormValues } from "./schemas/reportSchema";

type ReportActionModalProps = {
  open: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReportFormValues) => Promise<void> | void;
};

export function ReportActionModal({
  open,
  isSubmitting = false,
  onClose,
  onSubmit,
}: ReportActionModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<ReportReasonValue[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reasons: [],
      details: "",
    },
    mode: "onChange",
  });

  const reasons = watch("reasons");

  useEffect(() => {
    if (!open) {
      setSelectedReasons([]);
      reset({
        reasons: [],
        details: "",
      });
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement | null;
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
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus?.();
    };
  }, [open, reset]);

  const submitForm = async (data: ReportFormValues) => {
    await onSubmit(data);
    onClose();
  };

  const hasValidationError = !!errors.reasons?.message;

  if (!open) return null;

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

        <form onSubmit={handleSubmit(submitForm)}>
          <div className="px-6 py-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">Qual o motivo da denúncia?</p>

              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={reasons.includes(reason.value)}
                      onChange={() => {
                        const next = selectedReasons.includes(reason.value)
                          ? selectedReasons.filter((item) => item !== reason.value)
                          : [...selectedReasons, reason.value];

                        setSelectedReasons(next);
                        setValue("reasons", next, { shouldValidate: true, shouldDirty: true });
                      }}
                      label={reason.label}
                    />
                  </label>
                ))}
              </div>

              {hasValidationError ? (
                <p className="text-sm text-red-500">{errors.reasons?.message}</p>
              ) : null}
            </div>

            <div className="mt-6">
              <Textarea
                label="Descreva o motivo"
                placeholder="Digite aqui o motivo do qual está denunciando a ação"
                rows={5}
                error={errors.details?.message}
                {...register("details")}
              />
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
              disabled={!isValid || isSubmitting}
            >
              Denunciar
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}