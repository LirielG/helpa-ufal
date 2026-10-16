import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button, Input, Select, Textarea } from "../components";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import {
  AddressBlock,
  ConfirmFormatModal,
} from "../features/action-edit/components";
import {
  ACTION_CAMPUS_OPTIONS,
  ACTION_FORMAT_OPTIONS,
  ACTION_TYPE_OPTIONS,
} from "../features/dashboard/constants";
import {
  ActionEditSchema,
  type ActionEditSchemaType,
} from "../features/action-edit/validators";
import { getActionById } from "../features/action-detail/services";
import { handleActionApiErrors } from "../features/action-edit/handleApiErrors";
import { updateAction } from "../features/action-edit/services";
import type {
  ActionAddressPayload,
  UpdateActionPayload,
} from "../features/action-edit/types";
import { toInputDate, toInputTime } from "../utils";
import { fetchAreaSuggestions } from "../features/dashboard/services";

const EMPTY_ADDRESS = {
  addressLine: "",
  district: "",
  city: "",
  state: "",
  zipCode: "",
};

function toAddressPayload(
  address: ActionEditSchemaType["address"],
): ActionAddressPayload {
  return {
    addressLine: address?.addressLine ?? "",
    district: address?.district ?? "",
    city: address?.city ?? "",
    // An action saved before this screen existed may hold a lowercase state,
    // and the API only takes the uppercase abbreviation.
    state: (address?.state ?? "").toUpperCase(),
    zipCode: (address?.zipCode ?? "").replace(/\D/g, ""),
  };
}

export function EditAction() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [isLoadingAction, setIsLoadingAction] = useState(Boolean(id));
  const [loadFailed, setLoadFailed] = useState(false);
  const notFound = !id || loadFailed;

  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingData, setPendingData] = useState<ActionEditSchemaType | null>(
    null,
  );
  const [isConfirming, setIsConfirming] = useState(false);

  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    resolver: zodResolver(ActionEditSchema),
    mode: "onSubmit",
  });

  const currentFormat = useWatch({ control, name: "format" });

  useEffect(() => {
    let isMounted = true;
    fetchAreaSuggestions().then((suggestions) => {
      if (isMounted) setAreaSuggestions(suggestions);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    (async () => {
      const action = await getActionById(id);

      if (!isMounted) return;

      if (!action) {
        setLoadFailed(true);
        setIsLoadingAction(false);
        return;
      }

      reset({
        title: action.title,
        description: action.details?.description ?? "",
        startDate: toInputDate(action.startDate),
        endDate: toInputDate(action.endDate),
        startTime: toInputTime(action.startDate),
        endTime: toInputTime(action.endDate),
        type: action.type,
        slots: action.slots,
        format: action.details?.format,
        workloadHours: action.details?.workloadHours,
        area: action.details?.area ?? "",
        url: action.details?.url ?? "",
        campus: action.campus,
        address: action.details?.address
          ? {
              addressLine: action.details.address.addressLine ?? "",
              district: action.details.address.district ?? "",
              city: action.details.address.city ?? "",
              state: action.details.address.state ?? "",
              zipCode: action.details.address.zipCode
                ? action.details.address.zipCode.replace(
                    /^(\d{5})(\d)/,
                    "$1-$2",
                  )
                : "",
            }
          : EMPTY_ADDRESS,
      } as ActionEditSchemaType);

      setIsLoadingAction(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [id, reset]);

  const buildPayload = (data: ActionEditSchemaType): UpdateActionPayload => {
    const payload: UpdateActionPayload = {};

    if (dirtyFields.title) payload.title = data.title;
    if (dirtyFields.description) payload.description = data.description;
    if (
      dirtyFields.startDate ||
      dirtyFields.startTime ||
      dirtyFields.endDate ||
      dirtyFields.endTime
    ) {
      payload.startDate = new Date(
        `${data.startDate}T${data.startTime}:00`,
      ).toISOString();
      payload.endDate = new Date(
        `${data.endDate}T${data.endTime}:00`,
      ).toISOString();
    }
    if (dirtyFields.type) payload.type = data.type;
    if (dirtyFields.slots) payload.slots = data.slots;
    if (dirtyFields.workloadHours) payload.workloadHours = data.workloadHours;
    if (dirtyFields.area) payload.area = data.area.trim();
    if (dirtyFields.campus) payload.campus = data.campus;
    if (dirtyFields.format) payload.format = data.format;

    // Online and hybrid actions require a link, so switching to one of them
    // sends the current link along with the new format, even if it was not
    // edited.
    const urlRequiredByNewFormat =
      dirtyFields.format && data.format !== "IN_PERSON";

    if (dirtyFields.url || urlRequiredByNewFormat) {
      payload.url = data.url;
    }

    // `AddressSchema` is not partial on the API: every address object has to
    // carry the five fields, so one changed subfield sends the whole block.
    const addressChanged = Object.values(dirtyFields.address ?? {}).some(
      Boolean,
    );

    if (data.format !== "ONLINE" && (addressChanged || dirtyFields.format)) {
      payload.address = toAddressPayload(data.address);
    }

    return payload;
  };

  const executeSubmit = async (data: ActionEditSchemaType) => {
    if (!id) return;
    setGeneralError(null);

    const payload = buildPayload(data);

    // Nothing changed: no request, and the screen stays where it is.
    if (Object.keys(payload).length === 0) return;

    try {
      await updateAction(id, payload);
      navigate(`/activity/${id}`);
    } catch (error) {
      handleActionApiErrors(error, setError, setGeneralError, navigate);
    }
  };

  const onSubmit = async (data: ActionEditSchemaType) => {
    if (dirtyFields.format && data.format === "ONLINE") {
      setPendingData(data);
      setIsConfirmModalOpen(true);
      return;
    }

    await executeSubmit(data);
  };

  const handleConfirmModal = async () => {
    if (!pendingData) return;
    try {
      setIsConfirming(true);
      await executeSubmit(pendingData);
    } finally {
      setIsConfirming(false);
      setIsConfirmModalOpen(false);
      setPendingData(null);
    }
  };

  if (isLoadingAction) {
    return (
      <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </DashboardShell>
    );
  }

  if (notFound) {
    return (
      <DashboardShell header={<DashboardHeader />} footer={<Footer />}>
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-500">Ação não encontrada.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      header={<DashboardHeader />}
      footer={<Footer />}
      containerStyle={{ backgroundColor: "#E0F6F6" }}
    >
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {generalError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between shadow-sm">
            <span>{generalError}</span>
            <button
              type="button"
              onClick={() => setGeneralError(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm px-6 pt-6 pb-6 md:px-10 md:pt-10 md:pb-6 space-y-6"
        >
          {/* The prototype draws the title with no visible label. */}
          <Input
            aria-label="Título"
            placeholder="Título"
            error={errors.title?.message}
            {...register("title")}
          />

          <Textarea
            label="Descrição"
            placeholder="Descreva os detalhes da ação..."
            className="min-h-[150px]"
            error={errors.description?.message}
            {...register("description")}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 mb-1">
                    Horário
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="edit-start-time"
                        className="block text-xs text-gray-500 mb-1"
                      >
                        Início
                      </label>
                      <Input
                        id="edit-start-time"
                        size="sm"
                        type="time"
                        aria-label="Horário de início"
                        error={errors.startTime?.message}
                        {...register("startTime")}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="edit-end-time"
                        className="block text-xs text-gray-500 mb-1"
                      >
                        Fim
                      </label>
                      <Input
                        id="edit-end-time"
                        size="sm"
                        type="time"
                        aria-label="Horário de encerramento"
                        error={errors.endTime?.message}
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
                        htmlFor="edit-start-date"
                        className="block text-xs text-gray-500 mb-1"
                      >
                        Início
                      </label>
                      <Input
                        id="edit-start-date"
                        size="sm"
                        type="date"
                        aria-label="Data de início"
                        error={errors.startDate?.message}
                        {...register("startDate")}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-end-date"
                        className="block text-xs text-gray-500 mb-1"
                      >
                        Fim
                      </label>
                      <Input
                        id="edit-end-date"
                        size="sm"
                        type="date"
                        aria-label="Data de encerramento"
                        error={errors.endDate?.message}
                        {...register("endDate")}
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  size="sm"
                  label="Tipo da ação"
                  options={ACTION_TYPE_OPTIONS}
                  error={errors.type?.message}
                  {...register("type")}
                />
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  placeholder="0"
                  label="Número de vagas"
                  error={errors.slots?.message}
                  {...register("slots")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  size="sm"
                  label="Formato da ação"
                  options={ACTION_FORMAT_OPTIONS}
                  error={errors.format?.message}
                  {...register("format")}
                />
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  placeholder="0"
                  label="Carga horária"
                  error={errors.workloadHours?.message}
                  {...register("workloadHours")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    size="sm"
                    label="Área de atuação"
                    list="edit-area-suggestions"
                    placeholder="Digite ou selecione"
                    error={errors.area?.message}
                    {...register("area")}
                  />
                  <datalist id="edit-area-suggestions">
                    {areaSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
                {currentFormat !== "IN_PERSON" && (
                  <Input
                    size="sm"
                    label="Link para o evento"
                    placeholder="Ex: https://meet.google.com/abc-defg-hij"
                    error={errors.url?.message}
                    {...register("url")}
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div
                className={`transition-opacity duration-200 ${
                  currentFormat === "ONLINE"
                    ? "opacity-40 pointer-events-none select-none"
                    : "opacity-100"
                }`}
              >
                <AddressBlock
                  addressLineRegistration={register("address.addressLine")}
                  districtRegistration={register("address.district")}
                  zipCodeRegistration={register("address.zipCode")}
                  cityRegistration={register("address.city")}
                  stateRegistration={register("address.state")}
                  disabled={currentFormat === "ONLINE"}
                  errors={{
                    addressLine: errors.address?.addressLine?.message,
                    district: errors.address?.district?.message,
                    zipCode: errors.address?.zipCode?.message,
                    city: errors.address?.city?.message,
                    state: errors.address?.state?.message,
                  }}
                />
              </div>

              <Select
                size="sm"
                label="Campus"
                options={ACTION_CAMPUS_OPTIONS}
                error={errors.campus?.message}
                {...register("campus")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              size="sm"
              rounded
              variant="secondary"
              className="rounded-full px-8 py-2.5 font-medium"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              rounded
              variant="navy"
              className="rounded-full px-8 py-2.5 font-medium"
              isLoading={isSubmitting || isConfirming}
              disabled={isSubmitting || isConfirming}
            >
              Salvar
            </Button>
          </div>
        </form>
      </div>
      <ConfirmFormatModal
        isOpen={isConfirmModalOpen}
        isLoading={isConfirming}
        onConfirm={handleConfirmModal}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setPendingData(null);
        }}
      />
    </DashboardShell>
  );
}
