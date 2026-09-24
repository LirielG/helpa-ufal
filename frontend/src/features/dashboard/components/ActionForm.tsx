import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import helpaBlueLogo from "../../../assets/helpa-logo-blue.svg";
import {
  ACTION_AREA_OPTIONS,
  ACTION_TYPE_OPTIONS,
  ACTION_FORMAT_OPTIONS,
  ACTION_CAMPUS_OPTIONS,
} from "../constants";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { api } from "../../../services/api";
import { handleCreateActionApiErrors } from "../../action-edit/handleApiErrors";
import type { ActionType, ActionFormat, ActionCampus } from "../types";

const addressSchema = z.object({
  addressLine: z.string().min(1, "Informe o logradouro."),
  district: z.string().min(1, "Informe o bairro."),
  zipCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, "O CEP deve ter 8 dígitos."),
  city: z.string().min(1, "Informe a cidade."),
  state: z
    .string()
    .length(2, "Informe uma UF válida (ex.: AL)."),
});

const baseSchema = z.object({
  title: z.string().min(1, "Informe um título válido."),
  description: z.string().optional(),
  area: z.string().min(1, "Informe uma área de atuação válida."),
  type: z.enum(["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] as const, {
    error: "Selecione um tipo de ação válido.",
  }),
  campus: z.enum(
    ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] as const,
    { error: "Selecione um campus válido." },
  ),
  startDate: z
    .string()
    .min(1, "A data de início é obrigatória.")
    .refine(
      (v) => new Date(v) >= new Date(new Date().toISOString().split("T")[0]),
      { message: "A data de início deve ser futura." },
    ),
  startTime: z.string().min(1, "Informe o horário de início."),
  endDate: z.string().min(1, "A data de encerramento é obrigatória."),
  endTime: z.string().min(1, "Informe o horário de encerramento."),
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
  url: z.string().optional(),
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
      (d.format !== "IN_PERSON" && d.format !== "HYBRID") ||
      !!d.address?.state,
    { message: "Informe uma UF válida (ex.: AL).", path: ["address.state"] },
  );

type FormValues = z.input<typeof formSchema>;

const STEP1_FIELDS = new Set<string>(["title", "description", "area", "type"]);

interface CreateActivityPayload {
  title: string;
  description: string;
  type: ActionType;
  campus: ActionCampus;
  area: string;
  startDate: string;
  endDate: string;
  slots: number;
  workloadHours: number;
  format: ActionFormat;
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-red-500 mt-1" role="alert">
      {message}
    </p>
  );
}

const inputCls = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-700 placeholder:text-gray-400 ${
    hasError ? "border-red-400" : "border-gray-300"
  }`;

const selectCls = (hasError?: boolean) =>
  `w-full appearance-none border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B75BB] bg-white text-gray-700 pr-9 ${
    hasError ? "border-red-400" : "border-gray-300"
  }`;

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

interface ActionRegisterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ActionRegister({
  isOpen,
  onClose,
  onSuccess,
}: ActionRegisterProps) {
  const [step, setStep] = useState(1);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSuccessConfirm, setShowSuccessConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
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

  const format = watch("format");
  const startDate = watch("startDate");

  const needsUrl = format === "ONLINE" || format === "HYBRID";
  const needsAddress = format === "IN_PERSON" || format === "HYBRID";

  useEffect(() => {
    setGeneralError(null);
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
          description: data.description?.trim() || "Descrição não informada.",
          type: data.type as ActionType,
          campus: data.campus as ActionCampus,
          area: data.area,
          startDate: new Date(
            `${data.startDate}T${data.startTime}:00`,
          ).toISOString(),
          endDate: new Date(
            `${data.endDate}T${data.endTime}:00`,
          ).toISOString(),
          slots: data.slots as number,
          workloadHours: data.workloadHours as number,
          format: data.format as ActionFormat,
          ...(needsUrl && data.url?.trim() ? { url: data.url.trim() } : {}),
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

        await api.post<CreateActivityResponse>("/activities", payload);

        reset();
        setStep(1);
        setShowSuccessConfirm(true);
        if (onSuccess) onSuccess();
      } catch (err: any) {
        handleCreateActionApiErrors(err, setError, setGeneralError);
        if (err?.errors && Array.isArray(err.errors)) {
          const step1HasError = err.errors.some((e: any) =>
            STEP1_FIELDS.has(e.field),
          );
          if (step1HasError) setStep(1);
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

  if (!isOpen && !showSuccessConfirm && !showCancelConfirm) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 backdrop-blur-sm p-4">
      <div className="bg-[#E8EDF2] rounded-2xl w-full max-w-2xl flex shadow-2xl overflow-hidden">
        <div className="w-[220px] shrink-0 bg-[#0A2540] text-white flex flex-col justify-between py-8 px-7 relative overflow-hidden">
          <div className="flex flex-col gap-8 z-10 relative">
            <p className="text-sm font-semibold tracking-wide">
              Vamos criar uma ação?
            </p>
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <div
                  className={`size-7 rounded-full shrink-0 flex items-center justify-center font-bold text-sm mt-0.5 transition-colors ${
                    step === 1
                      ? "bg-white text-[#0A2540]"
                      : "bg-white/20 text-white"
                  }`}
                >
                  1
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">
                    Identificação
                  </p>
                  <p className="text-xs text-white/60 leading-tight mt-0.5">
                    Dê um nome para a sua ação
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div
                  className={`size-7 rounded-full shrink-0 flex items-center justify-center font-bold text-sm mt-0.5 transition-colors ${
                    step === 2
                      ? "bg-white text-[#0A2540]"
                      : "border-2 border-white/30 text-white/30"
                  }`}
                >
                  2
                </div>
                <div>
                  <p
                    className={`font-semibold text-sm leading-tight ${
                      step === 2 ? "text-white" : "text-white/30"
                    }`}
                  >
                    Logística
                  </p>
                  <p className="text-xs text-white/40 leading-tight mt-0.5">
                    Conte-nos onde e quando será
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-8 opacity-10 pointer-events-none select-none">
            <img src={helpaBlueLogo} alt="" className="h-28 w-auto" />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-r-2xl flex flex-col">
          <form onSubmit={onSubmit} className="flex flex-col h-full" noValidate>
            <div className="flex-1 overflow-y-auto px-8 pt-8 pb-4">
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
                  <h2 className="text-2xl font-bold text-[#0A2540]">
                    Dê um nome para a sua ação
                  </h2>

                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Título da ação
                    </label>
                    <input
                      id="title"
                      type="text"
                      placeholder="Digite o título da sua ação"
                      className={inputCls(!!errors.title)}
                      {...register("title")}
                    />
                    <FieldError message={errors.title?.message} />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Descrição completa{" "}
                      <span className="text-gray-400 font-normal">
                        (opcional)
                      </span>
                    </label>
                    <textarea
                      id="description"
                      placeholder="Descreva a sua ação"
                      rows={4}
                      className={`${inputCls(!!errors.description)} resize-none`}
                      {...register("description")}
                    />
                    <FieldError message={errors.description?.message} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="area"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Área de atuação
                      </label>
                      <SelectWrapper>
                        <select
                          id="area"
                          className={selectCls(!!errors.area)}
                          {...register("area")}
                        >
                          <option value="">Área de atuação</option>
                          {ACTION_AREA_OPTIONS.map((item) => (
                            <option key={item.value} value={item.label}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                      <FieldError message={errors.area?.message} />
                    </div>

                    <div>
                      <label
                        htmlFor="type"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Tipo da ação
                      </label>
                      <SelectWrapper>
                        <select
                          id="type"
                          className={selectCls(!!errors.type)}
                          {...register("type")}
                        >
                          <option value="">Tipo da ação</option>
                          {ACTION_TYPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                      <FieldError message={errors.type?.message} />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-2xl font-bold text-[#0A2540]">
                    Conte-nos onde e quando será
                  </h2>

                  <div>
                    <label
                      htmlFor="campus"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Campus
                    </label>
                    <SelectWrapper>
                      <select
                        id="campus"
                        className={selectCls(!!errors.campus)}
                        {...register("campus")}
                      >
                        <option value="" disabled>
                          Digite o campus em que ocorrerá a sua ação
                        </option>
                        {ACTION_CAMPUS_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                    <FieldError message={errors.campus?.message} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="workloadHours"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Carga horária total
                      </label>
                      <input
                        id="workloadHours"
                        type="number"
                        placeholder="ex: 12"
                        min="1"
                        max="8760"
                        className={inputCls(!!errors.workloadHours)}
                        {...register("workloadHours")}
                      />
                      <FieldError message={errors.workloadHours?.message} />
                    </div>

                    <div>
                      <label
                        htmlFor="slots"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Número de vagas
                      </label>
                      <input
                        id="slots"
                        type="number"
                        placeholder="ex: 12"
                        min="1"
                        max="10000"
                        className={inputCls(!!errors.slots)}
                        {...register("slots")}
                      />
                      <FieldError message={errors.slots?.message} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-700 mb-1">
                        Horário
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="startTime"
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Início
                          </label>
                          <input
                            id="startTime"
                            type="time"
                            className={inputCls(!!errors.startTime)}
                            {...register("startTime")}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="endTime"
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Fim
                          </label>
                          <input
                            id="endTime"
                            type="time"
                            className={inputCls(!!errors.endTime)}
                            {...register("endTime")}
                          />
                        </div>
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-700 mb-1">
                        Data
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="startDate"
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Início
                          </label>
                          <input
                            id="startDate"
                            type="date"
                            min={today}
                            className={inputCls(!!errors.startDate)}
                            {...register("startDate")}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="endDate"
                            className="block text-xs text-gray-500 mb-1"
                          >
                            Fim
                          </label>
                          <input
                            id="endDate"
                            type="date"
                            min={startDate || today}
                            className={inputCls(!!errors.endDate)}
                            {...register("endDate")}
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

                  <div className="w-1/2">
                    <label
                      htmlFor="format"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Formato da ação
                    </label>
                    <SelectWrapper>
                      <select
                        id="format"
                        className={selectCls(!!errors.format)}
                        {...register("format")}
                      >
                        <option value="">Formato da ação</option>
                        {ACTION_FORMAT_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                    <FieldError message={errors.format?.message} />
                  </div>

                  {needsUrl && (
                    <div>
                      <label
                        htmlFor="url"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Link para o evento
                      </label>
                      <input
                        id="url"
                        type="url"
                        placeholder="Ex: https://meet.google.com/abc-defg-hij"
                        className={inputCls(!!errors.url)}
                        {...register("url")}
                      />
                      <FieldError message={errors.url?.message} />
                    </div>
                  )}

                  {needsAddress && (
                    <fieldset className="flex flex-col gap-4">
                      <legend className="text-sm font-semibold text-[#0A2540]">
                        Endereço
                      </legend>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="address.addressLine"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Logradouro
                          </label>
                          <input
                            id="address.addressLine"
                            type="text"
                            placeholder="ex: Rua Dois"
                            className={inputCls(!!errors.address?.addressLine)}
                            {...register("address.addressLine")}
                          />
                          <FieldError
                            message={errors.address?.addressLine?.message}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="address.district"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Bairro
                          </label>
                          <input
                            id="address.district"
                            type="text"
                            placeholder="ex: Bairro Jardim"
                            className={inputCls(!!errors.address?.district)}
                            {...register("address.district")}
                          />
                          <FieldError
                            message={errors.address?.district?.message}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <label
                            htmlFor="address.zipCode"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            CEP
                          </label>
                          <input
                            id="address.zipCode"
                            type="text"
                            placeholder="00000-000"
                            maxLength={9}
                            className={inputCls(!!errors.address?.zipCode)}
                            {...register("address.zipCode")}
                          />
                          <FieldError
                            message={errors.address?.zipCode?.message}
                          />
                        </div>

                        <div className="col-span-5">
                          <label
                            htmlFor="address.city"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Cidade
                          </label>
                          <input
                            id="address.city"
                            type="text"
                            placeholder="ex: Bom Jesus"
                            className={inputCls(!!errors.address?.city)}
                            {...register("address.city")}
                          />
                          <FieldError message={errors.address?.city?.message} />
                        </div>

                        <div className="col-span-3">
                          <label
                            htmlFor="address.state"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Estado
                          </label>
                          <input
                            id="address.state"
                            type="text"
                            placeholder="ex: AL"
                            maxLength={2}
                            className={`${inputCls(!!errors.address?.state)} uppercase`}
                            {...register("address.state")}
                          />
                          <FieldError
                            message={errors.address?.state?.message}
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-8 py-5 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#4A0E0E] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
              >
                <X className="size-3.5" /> Cancelar
              </button>

              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#0A2540] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1B75BB] transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="size-3.5" /> Voltar
                  </button>
                )}

                {step === 1 ? (
                  <button
                    type="button"
                    onClick={handleStep1Next}
                    className="px-6 py-2 bg-[#0A2540] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1B75BB] transition-colors"
                  >
                    Próximo <ArrowRight className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-[#05442A] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-green-800 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Criando...
                      </>
                    ) : (
                      <>
                        Criar ação <Check className="size-3.5 stroke-[3]" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
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
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full bg-[#0A2540] text-white py-3 px-6 rounded-xl text-sm font-semibold hover:bg-[#1B75BB] transition-colors"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="w-full border border-[#4A0E0E] text-[#4A0E0E] py-3 px-6 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 flex flex-col items-center text-center shadow-xl">
            <div className="bg-[#05442A] text-white p-2 rounded-lg mb-4 flex items-center justify-center size-10">
              <Check className="size-6 stroke-[3]" />
            </div>
            <h3 className="text-lg font-bold text-[#0A2540] max-w-[240px] mb-6">
              Sua ação foi registrada com sucesso!
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowSuccessConfirm(false);
                onClose();
              }}
              className="w-full bg-[#0A2540] text-white py-3 px-6 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1B75BB] transition-colors"
            >
              <Eye className="size-4" /> Visualizar no feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
