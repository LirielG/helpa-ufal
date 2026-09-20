import React, { useState } from "react";
import helpaBlueLogo from "../../../assets/helpa-logo-blue.svg";
import {
  ACTION_AREA_OPTIONS,
  ACTION_TYPE_OPTIONS,
  ACTION_FORMAT_OPTIONS,
  ACTION_CAMPUS_OPTIONS,
} from "../constants";
import { X, ArrowRight, ArrowLeft, Check, Eye, Loader2, ChevronDown } from "lucide-react";
import { api } from "../../../services/api";
import { ApiError } from "../../../services/apiError";
import { useFormErrors } from "../../../hooks";
import type { ActionType, ActionFormat, ActionCampus } from "../types";

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

function toISOString(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function stripMask(value: string): string {
  return value.replace(/\D/g, "");
}

const STEP1_ERROR_FIELDS = new Set(["title", "area", "type"]);

const FIELD_MESSAGES_PT: Record<string, string> = {
  title: "Título obrigatório.",
  description: "Descrição obrigatória.",
  type: "Tipo de ação obrigatório.",
  campus: "Campus obrigatório.",
  area: "Área de atuação obrigatória.",
  startDate: "Data de início inválida ou no passado.",
  endDate: "Data de encerramento deve ser posterior à data de início.",
  slots: "Número de vagas inválido (máx. 10.000).",
  workloadHours: "Carga horária não pode exceder a duração total da ação.",
  format: "Formato obrigatório.",
  url: "URL obrigatória para ações on-line ou híbridas.",
  "address.addressLine": "Logradouro obrigatório.",
  "address.district": "Bairro obrigatório.",
  "address.zipCode": "CEP deve ter exatamente 8 dígitos.",
  "address.city": "Cidade obrigatória.",
  "address.state": "Estado deve ser uma sigla válida (ex: AL).",
};

function ptMessage(field: string, fallback: string): string {
  return FIELD_MESSAGES_PT[field] ?? fallback;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
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

export function ActionRegister({ isOpen, onClose, onSuccess }: ActionRegisterProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSuccessConfirm, setShowSuccessConfirm] = useState(false);

  const { errors, setErrorsFromArray, addError, clearAllErrors } = useFormErrors();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState<ActionType | "">("");

  const [campus, setCampus] = useState<ActionCampus>("ARAPIRACA");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("18:00");
  const [workload, setWorkload] = useState("");
  const [spots, setSpots] = useState("");
  const [format, setFormat] = useState<ActionFormat | "">("");
  const [url, setUrl] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [district, setDistrict] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const needsUrl = format === "ONLINE" || format === "HYBRID";
  const needsAddress = format === "IN_PERSON" || format === "HYBRID";

  const isDirty =
    title.trim() !== "" || description.trim() !== "" || area !== "" ||
    type !== "" || startDate !== "" || endDate !== "" || workload !== "" ||
    spots !== "" || format !== "" || url.trim() !== "" ||
    addressLine.trim() !== "" || district.trim() !== "" ||
    zipCode.trim() !== "" || city.trim() !== "" || state.trim() !== "";

  const today = new Date().toISOString().split("T")[0];

  function resetForm() {
    setTitle(""); setDescription(""); setArea(""); setType("");
    setCampus("ARAPIRACA"); setStartDate(""); setStartTime("08:00");
    setEndDate(""); setEndTime("18:00"); setWorkload(""); setSpots("");
    setFormat(""); setUrl(""); setAddressLine(""); setDistrict("");
    setZipCode(""); setCity(""); setState("");
    clearAllErrors();
    setStep(1);
  }

  function handleCancelClick() {
    if (!isDirty) { onClose(); return; }
    setShowCancelConfirm(true);
  }

  function handleDiscard() {
    resetForm();
    setShowCancelConfirm(false);
    onClose();
  }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    clearAllErrors();

    if (step === 1) { setStep(2); return; }

    setIsLoading(true);
    try {
      const payload: CreateActivityPayload = {
        title,
        description: description.trim() || "Descrição não informada.",
        type: type as ActionType,
        campus,
        area,
        startDate: toISOString(startDate, startTime),
        endDate: toISOString(endDate, endTime),
        slots: Number(spots),
        workloadHours: Number(workload),
        format: format as ActionFormat,
        ...(needsUrl && url.trim() ? { url: url.trim() } : {}),
        ...(needsAddress ? {
          address: {
            addressLine,
            district,
            zipCode: stripMask(zipCode),
            city,
            state: state.toUpperCase(),
          },
        } : {}),
      };

      await api.post<CreateActivityResponse>("/activities", payload);
      resetForm();
      setShowSuccessConfirm(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return;
        if (err.status === 400 && err.errors?.length) {
          const translated = err.errors.map((e) => ({
            field: e.field,
            message: ptMessage(e.field, e.message),
          }));
          setErrorsFromArray(translated);
          if (translated.some((e) => STEP1_ERROR_FIELDS.has(e.field))) setStep(1);
          return;
        }
        if (err.status === 0) {
          addError("_network", "Erro de conexão. Verifique sua internet e tente novamente.");
          return;
        }
      }
      addError("_network", "Não foi possível criar a ação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen && !showSuccessConfirm && !showCancelConfirm) return null;

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
                <div className={`size-7 rounded-full shrink-0 flex items-center justify-center font-bold text-sm mt-0.5 transition-colors ${
                  step === 1 ? "bg-white text-[#0A2540]" : "bg-white/20 text-white"
                }`}>
                  1
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">Identificação</p>
                  <p className="text-xs text-white/60 leading-tight mt-0.5">
                    Dê um nome para a sua ação
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`size-7 rounded-full shrink-0 flex items-center justify-center font-bold text-sm mt-0.5 transition-colors ${
                  step === 2
                    ? "bg-white text-[#0A2540]"
                    : "border-2 border-white/30 text-white/30"
                }`}>
                  2
                </div>
                <div>
                  <p className={`font-semibold text-sm leading-tight ${step === 2 ? "text-white" : "text-white/30"}`}>
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
          <form onSubmit={handleNext} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-8 pt-8 pb-4">

              {errors._network && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {errors._network}
                </div>
              )}

              {step === 1 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-2xl font-bold text-[#0A2540]">
                    Dê um nome para a sua ação
                  </h2>

                  <div>
                    <Label>Título da ação</Label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Digite o título da sua ação"
                      className={inputCls(!!errors.title)}
                      required
                    />
                    <FieldError message={errors.title} />
                  </div>

                  <div>
                    <Label>
                      Descrição completa{" "}
                      <span className="text-gray-400 font-normal">(opcional)</span>
                    </Label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva a sua ação"
                      rows={4}
                      className={`${inputCls()} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <SelectWrapper>
                        <select
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className={selectCls(!!errors.area)}
                          required
                        >
                          <option value="">Área de atuação</option>
                          {ACTION_AREA_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                      <FieldError message={errors.area} />
                    </div>

                    <div>
                      <SelectWrapper>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as ActionType)}
                          className={selectCls(!!errors.type)}
                          required
                        >
                          <option value="">Tipo da ação</option>
                          {ACTION_TYPE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                      <FieldError message={errors.type} />
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
                    <SelectWrapper>
                      <select
                        value={campus}
                        onChange={(e) => setCampus(e.target.value as ActionCampus)}
                        className={selectCls(!!errors.campus)}
                        required
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
                    <FieldError message={errors.campus} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Carga horária total</Label>
                      <input
                        type="number"
                        value={workload}
                        onChange={(e) => setWorkload(e.target.value)}
                        placeholder="ex: 12"
                        min="1"
                        max="8760"
                        className={inputCls(!!errors.workloadHours)}
                        required
                      />
                      <FieldError message={errors.workloadHours} />
                    </div>

                    <div>
                      <Label>Número de vagas</Label>
                      <input
                        type="number"
                        value={spots}
                        onChange={(e) => setSpots(e.target.value)}
                        placeholder="ex: 12"
                        min="1"
                        max="10000"
                        className={inputCls(!!errors.slots)}
                        required
                      />
                      <FieldError message={errors.slots} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Horário</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Início</p>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className={inputCls()}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fim</p>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className={inputCls()}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Data</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Início</p>
                          <input
                            type="date"
                            value={startDate}
                            min={today}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={inputCls(!!errors.startDate)}
                            required
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fim</p>
                          <input
                            type="date"
                            value={endDate}
                            min={startDate || today}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={inputCls(!!errors.endDate)}
                            required
                          />
                        </div>
                      </div>
                      {(errors.startDate || errors.endDate) && (
                        <FieldError message={errors.startDate ?? errors.endDate} />
                      )}
                    </div>
                  </div>

                  <div className="w-1/2">
                    <SelectWrapper>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as ActionFormat)}
                        className={selectCls(!!errors.format)}
                        required
                      >
                        <option value="">Formato da ação</option>
                        {ACTION_FORMAT_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                    <FieldError message={errors.format} />
                  </div>

                  {needsUrl && (
                    <div>
                      <Label>Link para o evento</Label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Ex: meet.google.com/abc-defg-hij"
                        className={inputCls(!!errors.url)}
                        required
                      />
                      <FieldError message={errors.url} />
                    </div>
                  )}

                  {needsAddress && (
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-semibold text-[#0A2540]">
                        Endereço
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Logradouro</Label>
                          <input
                            type="text"
                            value={addressLine}
                            onChange={(e) => setAddressLine(e.target.value)}
                            placeholder="ex: Rua Dois"
                            className={inputCls(!!errors["address.addressLine"])}
                            required
                          />
                          <FieldError message={errors["address.addressLine"]} />
                        </div>

                        <div>
                          <Label>Bairro</Label>
                          <input
                            type="text"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder="ex: Bairro Jardim"
                            className={inputCls(!!errors["address.district"])}
                            required
                          />
                          <FieldError message={errors["address.district"]} />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <Label>CEP</Label>
                          <input
                            type="text"
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            placeholder="00000-000"
                            maxLength={9}
                            className={inputCls(!!errors["address.zipCode"])}
                            required
                          />
                          <FieldError message={errors["address.zipCode"]} />
                        </div>

                        <div className="col-span-5">
                          <Label>Cidade</Label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="ex: Bom Jesus"
                            className={inputCls(!!errors["address.city"])}
                            required
                          />
                          <FieldError message={errors["address.city"]} />
                        </div>

                        <div className="col-span-3">
                          <Label>Estado</Label>
                          <input
                            type="text"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            placeholder="ex: AL"
                            maxLength={2}
                            className={`${inputCls(!!errors["address.state"])} uppercase`}
                            required
                          />
                          <FieldError message={errors["address.state"]} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-8 py-5 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isLoading}
                className="px-5 py-2 bg-[#4A0E0E] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
              >
                <X className="size-3.5" /> Cancelar
              </button>

              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                    className="px-5 py-2 bg-[#0A2540] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1B75BB] transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="size-3.5" /> Voltar
                  </button>
                )}

                {step === 1 ? (
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#0A2540] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1B75BB] transition-colors"
                  >
                    Próximo <ArrowRight className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-[#05442A] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 hover:bg-green-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <><Loader2 className="size-4 animate-spin" /> Criando...</>
                    ) : (
                      <>Criar ação <Check className="size-3.5 stroke-[3]" /></>
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
              onClick={() => { setShowSuccessConfirm(false); onClose(); }}
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
