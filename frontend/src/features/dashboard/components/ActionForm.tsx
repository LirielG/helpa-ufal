import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { z } from "zod";
import {
  ACTION_TYPE_OPTIONS,
  ACTION_FORMAT_OPTIONS,
  ACTION_CAMPUS_OPTIONS,
} from "../constants";
import { X, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "../../../services/api";
import { ApiError } from "../../../services/apiError";
import {
  ACTION_URL_INVALID_MESSAGE,
  activityDescriptionSchema,
  activityTitleSchema,
  isValidActionUrl,
  normalizeActionUrl,
  validateWorkloadDuration,
} from "../../../validators/activity";
import { handleCreateActionApiErrors } from "../../action-edit/handleApiErrors";
import type {
  ActivityType,
  ActivityFormat,
  CampusLocation,
} from "@/services/contracts/activity";
import { fetchAreaSuggestions } from "../services";
import {
  Button,
  DatePicker,
  Input,
  Select,
  Textarea,
  TimeInput,
} from "../../../components";
import { timeSchema } from "../../../validators/time";
import { formatISODate } from "../../../utils/dateField";

const addressSchema = z.object({
  addressLine: z.string().min(1, "Informe o logradouro."),
  district: z.string().min(1, "Informe o bairro."),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, "O CEP deve ter 8 dígitos."),
  city: z.string().min(1, "Informe a cidade."),
  state: z.string().length(2, "Informe uma UF válida (ex.: AL)."),
});

const baseSchema = z.object({
  title: activityTitleSchema,
  description: activityDescriptionSchema,
  area: z.string().trim().min(1, "Informe uma área de atuação válida."),
  type: z.enum(["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] as const, {
    error: "Selecione um tipo de ação válido.",
  }),
  campus: z.enum(
    [
      "MACEIO",
      "ARAPIRACA",
      "PALMEIRA",
      "PENEDO",
      "RIO_LARGO",
      "DELMIRO_GOUVEIA",
      "SANTANA_IPANEMA",
    ] as const,
    { error: "Selecione um campus válido." },
  ),
  startDate: z
    .string()
    .min(1, "A data de início é obrigatória.")
    // aaaa-mm-dd strings sort chronologically, and both sides use the local day.
    .refine((v) => v >= formatISODate(new Date()), {
      message: "A data de início deve ser futura.",
    }),
  startTime: timeSchema("Informe o horário de início."),
  endDate: z.string().min(1, "A data de encerramento é obrigatória."),
  endTime: timeSchema("Informe o horário de encerramento."),
  workloadHours: z.coerce
    .number({ error: "Informe a carga horária." })
    .int()
    .min(1, "Informe uma carga horária válida.")
    .max(8760, "A carga horária não pode exceder 8.760 h."),
  slots: z.coerce
    .number({ error: "Informe o número de vagas." })
    .int()
    .min(1, "Informe pelo menos 1 vaga.")
    .max(10000, "O máximo é 10.000 vagas."),
  format: z.enum(["IN_PERSON", "ONLINE", "HYBRID"] as const, {
    error: "Selecione um formato de ação válido.",
  }),
  url: z
    .string()
    .optional()
    .transform((url) => (url === undefined ? url : normalizeActionUrl(url))),
  address: addressSchema.optional(),
});

const formSchema = baseSchema
  .refine(
    (d) =>
      new Date(`${d.endDate}T${d.endTime}`) >
      new Date(`${d.startDate}T${d.startTime}`),
    {
      message: "A data de encerramento deve ser posterior à de início.",
      path: ["endDate"],
    },
  )
  .superRefine(validateWorkloadDuration)
  .refine(
    (d) =>
      (d.format !== "ONLINE" && d.format !== "HYBRID") ||
      (!!d.url && d.url.trim() !== ""),
    {
      message:
        "Informe um link válido. Ele é obrigatório em ações on-line e híbridas.",
      path: ["url"],
    },
  )
  .refine(
    (d) =>
      (d.format !== "ONLINE" && d.format !== "HYBRID") ||
      !d.url ||
      isValidActionUrl(d.url),
    { message: ACTION_URL_INVALID_MESSAGE, path: ["url"] },
  )
  .refine(
    (d) =>
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") ||
      !!d.address?.addressLine,
    { message: "Informe o logradouro.", path: ["address.addressLine"] },
  )
  .refine(
    (d) =>
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") ||
      !!d.address?.district,
    { message: "Informe o bairro.", path: ["address.district"] },
  )
  .refine(
    (d) =>
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") ||
      !!d.address?.zipCode,
    { message: "O CEP deve ter 8 dígitos.", path: ["address.zipCode"] },
  )
  .refine(
    (d) =>
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") || !!d.address?.city,
    { message: "Informe a cidade.", path: ["address.city"] },
  )
  .refine(
    (d) =>
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") || !!d.address?.state,
    { message: "Informe uma UF válida (ex.: AL).", path: ["address.state"] },
  );

type FormValues = z.input<typeof formSchema>;

const STEP1_FIELDS = new Set<string>(["title", "description", "area", "type"]);

const STEP_NAMES = { 1: "Identificação", 2: "Logística" } as const;

interface CreateActivityPayload {
  title: string;
  description: string;
  type: ActivityType;
  campus: CampusLocation;
  area: string;
  startDate: string;
  endDate: string;
  slots: number;
  workloadHours: number;
  format: ActivityFormat;
  url?: string;
  address?: {
    addressLine: string;
    district: string;
    zipCode: string;
    city: string;
    state: string;
  };
}

interface CreateActivityResponse {
  id: string;
}

const TYPE_SELECT_OPTIONS = [
  { value: "", label: "Tipo da ação" },
  ...ACTION_TYPE_OPTIONS,
];

const FORMAT_SELECT_OPTIONS = [
  { value: "", label: "Formato da ação" },
  ...ACTION_FORMAT_OPTIONS,
];

interface ActionRegisterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdId: string) => void;
}

export function ActionRegister({
  isOpen,
  onClose,
  onSuccess,
}: ActionRegisterProps) {
  const titleId = useId();
  const [step, setStep] = useState<keyof typeof STEP_NAMES>(1);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    fetchAreaSuggestions().then((suggestions) => {
      if (isMounted) setAreaSuggestions(suggestions);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    reset,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      campus: "ARAPIRACA",
      startTime: "08:00",
      endTime: "18:00",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const format = watch("format");

  const startDate = watch("startDate");

  const needsUrl = format === "ONLINE" || format === "HYBRID";

  const needsAddress = format === "IN_PERSON" || format === "HYBRID";

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Both steps share one scroll area, so without this step 2 opens wherever
  // step 1 was scrolled to, hiding its heading and the mobile step label.
  useEffect(() => {
    setGeneralError(null);
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
  }, [step]);

  function handleCancelClick() {
    if (!isDirty) {
      onClose();
      return;
    }
    setShowCancelConfirm(true);
  }

  function handleDiscard() {
    reset();
    setStep(1);
    setGeneralError(null);
    setShowCancelConfirm(false);
    onClose();
  }

  async function handleStep1Next() {
    setGeneralError(null);
    const isValid = await trigger(["title", "description", "area", "type"], {
      shouldFocus: true,
    });
    if (isValid) {
      setStep(2);
    }
  }

  const onSubmit = handleSubmit(
    async (data) => {
      setGeneralError(null);

      try {
        const payload: CreateActivityPayload = {
          title: data.title,
          description: data.description,
          type: data.type as ActivityType,
          campus: data.campus as CampusLocation,
          area: data.area.trim(),
          startDate: new Date(
            `${data.startDate}T${data.startTime}:00`,
          ).toISOString(),
          endDate: new Date(`${data.endDate}T${data.endTime}:00`).toISOString(),
          slots: data.slots as number,
          workloadHours: data.workloadHours as number,
          format: data.format as ActivityFormat,
          ...(needsUrl && data.url ? { url: data.url } : {}),
          ...(needsAddress && data.address
            ? {
                address: {
                  addressLine: data.address.addressLine,
                  district: data.address.district,
                  zipCode: data.address.zipCode.replace(/\D/g, ""),
                  city: data.address.city,
                  state: data.address.state.toUpperCase(),
                },
              }
            : {}),
        };

        const created = await api.post<CreateActivityResponse>(
          "/activities",
          payload,
        );

        reset();
        setStep(1);
        toast.success("Ação criada.");
        onClose();
        onSuccess?.(created.id);
      } catch (err) {
        handleCreateActionApiErrors(err, setError, setGeneralError);
        if (
          err instanceof ApiError &&
          err.errors.some((e) => STEP1_FIELDS.has(e.field))
        ) {
          setStep(1);
        }
      }
    },
    (validationErrors) => {
      const step1HasError = Object.keys(validationErrors).some((k) =>
        STEP1_FIELDS.has(k),
      );
      if (step1HasError) setStep(1);
    },
  );

  if (!isOpen && !showCancelConfirm) return null;

  const today = formatISODate(new Date());

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-6 pb-4 border-b border-gray-100 md:px-8 md:pt-7">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-[#0A2540]">
              Criar uma ação
            </h2>
            <p
              aria-live="polite"
              className="mt-1 text-xs font-semibold text-[#072C59]"
            >
              Passo {step} de 2 · {STEP_NAMES[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col flex-1 min-h-0"
          noValidate
        >
          <div
            ref={scrollAreaRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-4 md:px-8 md:pt-6"
          >
            {generalError && (
              <div
                className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3"
                role="alert"
              >
                {generalError}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <h3 className="text-lg font-semibold text-[#0A2540]">
                  Dê um nome para a sua ação
                </h3>

                <Input
                  id="title"
                  size="sm"
                  type="text"
                  label="Título da ação"
                  placeholder="Digite o título da sua ação"
                  error={errors.title?.message}
                  {...register("title")}
                />

                <Textarea
                  id="description"
                  label="Descrição completa"
                  placeholder="Descreva a sua ação"
                  rows={4}
                  error={errors.description?.message}
                  {...register("description")}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Input
                      id="area"
                      size="sm"
                      type="text"
                      label="Área de atuação"
                      list="area-suggestions"
                      placeholder="Digite ou selecione a área"
                      error={errors.area?.message}
                      {...register("area")}
                    />
                    <datalist id="area-suggestions">
                      {areaSuggestions.map((area) => (
                        <option key={area} value={area} />
                      ))}
                    </datalist>
                  </div>

                  <Select
                    id="type"
                    size="sm"
                    label="Tipo da ação"
                    options={TYPE_SELECT_OPTIONS}
                    error={errors.type?.message}
                    {...register("type")}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <h3 className="text-lg font-semibold text-[#0A2540]">
                  Conte-nos onde e quando será
                </h3>

                <Select
                  id="campus"
                  size="sm"
                  label="Campus"
                  options={ACTION_CAMPUS_OPTIONS}
                  error={errors.campus?.message}
                  {...register("campus")}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="workloadHours"
                    size="sm"
                    type="number"
                    label="Carga horária total"
                    placeholder="ex: 12"
                    min="1"
                    max="8760"
                    error={errors.workloadHours?.message}
                    {...register("workloadHours")}
                  />

                  <Input
                    id="slots"
                    size="sm"
                    type="number"
                    label="Número de vagas"
                    placeholder="ex: 12"
                    min="1"
                    max="10000"
                    error={errors.slots?.message}
                    {...register("slots")}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-1">
                      Horário
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="startTime"
                          className="block text-xs text-gray-500 mb-1"
                        >
                          Início
                        </label>
                        <Controller
                          name="startTime"
                          control={control}
                          render={({ field }) => (
                            <TimeInput
                              id="startTime"
                              aria-label="Horário de início"
                              aria-invalid={errors.startTime ? true : undefined}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              ref={field.ref}
                              error={errors.startTime?.message}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="endTime"
                          className="block text-xs text-gray-500 mb-1"
                        >
                          Fim
                        </label>
                        <Controller
                          name="endTime"
                          control={control}
                          render={({ field }) => (
                            <TimeInput
                              id="endTime"
                              aria-label="Horário de encerramento"
                              aria-invalid={errors.endTime ? true : undefined}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              ref={field.ref}
                              error={errors.endTime?.message}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-1">
                      Data
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="startDate"
                          className="block text-xs text-gray-500 mb-1"
                        >
                          Início
                        </label>
                        <Controller
                          name="startDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              id="startDate"
                              aria-label="Data de início"
                              min={today}
                              invalid={!!errors.startDate}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              ref={field.ref}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="endDate"
                          className="block text-xs text-gray-500 mb-1"
                        >
                          Fim
                        </label>
                        <Controller
                          name="endDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              id="endDate"
                              aria-label="Data de encerramento"
                              min={startDate || today}
                              invalid={!!errors.endDate}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              ref={field.ref}
                            />
                          )}
                        />
                      </div>
                    </div>
                    {(errors.startDate || errors.endDate) && (
                      <p className="text-xs text-red-500 mt-1" role="alert">
                        {errors.startDate?.message ?? errors.endDate?.message}
                      </p>
                    )}
                  </fieldset>
                </div>

                <div className="w-full sm:w-1/2">
                  <Select
                    id="format"
                    size="sm"
                    label="Formato da ação"
                    options={FORMAT_SELECT_OPTIONS}
                    error={errors.format?.message}
                    {...register("format")}
                  />
                </div>

                {needsUrl && (
                  <Input
                    id="url"
                    size="sm"
                    type="url"
                    label="Link para o evento"
                    placeholder="Ex: https://meet.google.com/abc-defg-hij"
                    error={errors.url?.message}
                    {...register("url", {
                      onBlur: (e) =>
                        setValue("url", normalizeActionUrl(e.target.value)),
                    })}
                  />
                )}

                {needsAddress && (
                  <fieldset className="flex flex-col gap-4">
                    <legend className="text-sm font-semibold text-[#0A2540]">
                      Endereço
                    </legend>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        id="address.addressLine"
                        size="sm"
                        type="text"
                        label="Logradouro"
                        placeholder="ex: Rua Dois"
                        error={errors.address?.addressLine?.message}
                        {...register("address.addressLine")}
                      />

                      <Input
                        id="address.district"
                        size="sm"
                        type="text"
                        label="Bairro"
                        placeholder="ex: Bairro Jardim"
                        error={errors.address?.district?.message}
                        {...register("address.district")}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <Input
                          id="address.zipCode"
                          size="sm"
                          type="text"
                          label="CEP"
                          placeholder="00000-000"
                          maxLength={9}
                          error={errors.address?.zipCode?.message}
                          {...register("address.zipCode")}
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <Input
                          id="address.city"
                          size="sm"
                          type="text"
                          label="Cidade"
                          placeholder="ex: Bom Jesus"
                          error={errors.address?.city?.message}
                          {...register("address.city")}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <Input
                          id="address.state"
                          size="sm"
                          type="text"
                          label="Estado"
                          placeholder="ex: AL"
                          maxLength={2}
                          className="uppercase"
                          error={errors.address?.state?.message}
                          {...register("address.state")}
                        />
                      </div>
                    </div>
                  </fieldset>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 px-5 py-4 border-t border-gray-100 sm:flex-row sm:justify-between sm:items-center md:px-8 md:py-5">
            <Button
              type="button"
              variant="danger"
              size="sm"
              rounded
              onClick={handleCancelClick}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-5"
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-3">
              {step === 2 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  rounded
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5"
                >
                  <ArrowLeft className="size-3.5" /> Voltar
                </Button>
              )}

              {/* Distinct keys keep React from turning this same button into
                  the submit one: the step changes before the browser runs the
                  click's default action, which would then submit step 2. */}
              {step === 1 ? (
                <Button
                  key="next"
                  type="button"
                  variant="navy"
                  size="sm"
                  rounded
                  onClick={handleStep1Next}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6"
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  key="submit"
                  type="submit"
                  size="sm"
                  rounded
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 !bg-[#05442A] hover:!bg-green-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    "Criar ação"
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 flex flex-col items-center text-center shadow-xl">
            <div className="bg-[#4A0E0E] text-white p-2 rounded-lg mb-4 flex items-center justify-center size-10">
              <X className="size-6 stroke-[3]" />
            </div>
            <h3 className="text-lg font-bold text-[#0A2540] mb-1">
              Descartar esta ação?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Você vai perder o que já preencheu.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button
                type="button"
                variant="navy"
                size="md"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full"
              >
                Continuar editando
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleDiscard}
                className="w-full"
              >
                Descartar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
