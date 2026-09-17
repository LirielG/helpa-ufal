import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "../components";
//import { useAuth } from "../hooks";                               VER ISSO DPS
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import {
  TitleField,
  DescriptionField,
  DateField,
  ActionTypeField,
  SlotsField,
  AddressBlock,
  AreaField,
  CampusField,
  FormatField,
  UrlField,
  WorkloadField,
  ConfirmFormatModal
} from "../features/action-edit/components";
import {
  ActionEditSchema,
  type ActionEditSchemaType,
} from "../features/action-edit/validators";
import { getActionById } from "../features/action-detail/services";
import { handleActionApiErrors } from "../features/action-edit/handleApiErrors";
import { updateAction } from "../features/action-edit/services";
import { toInputDate } from "../utils";

function formatActionInputDate(dateStr?: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  return toInputDate(dateStr);
}

export function EditAction() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
 // const { user } = useAuth();

  const [isLoadingAction, setIsLoadingAction] = useState(Boolean(id));
  const [loadFailed, setLoadFailed] = useState(false);
  const notFound = !id || loadFailed;

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingData, setPendingData] = useState<ActionEditSchemaType | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    resolver: zodResolver(ActionEditSchema),
    mode: "onSubmit",
  });

  const zipCodeValue = useWatch({ control, name: "address.zipCode" });
  const currentFormat = useWatch({ control, name: "format" });

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = e.target.value
      .replace(/\D/g, "")
      .replace(/^(\d{5})(\d)/, "$1-$2")
      .slice(0, 9);

    setValue("address.zipCode", masked, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

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
      startDate: formatActionInputDate(action.startDate),
      endDate: formatActionInputDate(action.endDate),
      type: action.type,
      slots: action.slots,
      format: action.details?.format as ActionEditSchemaType["format"],
      workloadHours: action.details?.workloadHours,
      area: action.details?.area as ActionEditSchemaType["area"],
      url: action.details?.url ?? "",
      campus: action.campus as ActionEditSchemaType["campus"],
      address: action.details?.address
        ? {
            addressLine: action.details.address.addressLine ?? "",
            district: action.details.address.district ?? "",
            city: action.details.address.city ?? "",
            state: action.details.address.state ?? "",
            zipCode: action.details.address.zipCode
              ? action.details.address.zipCode.replace(/^(\d{5})(\d)/, "$1-$2")
              : "",
          }
        : {
            addressLine: "",
            district: "",
            city: "",
            state: "",
            zipCode: "",
          },
      } as ActionEditSchemaType);

      setIsLoadingAction(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [id, reset]);

  const executeSubmit = async (data: ActionEditSchemaType) => {
    if (!id) return;
    setGeneralError(null);

    const payload: Record<string, unknown> = {};

    if (dirtyFields.title) payload.title = data.title.trim();
    if (dirtyFields.description) payload.description = data.description.trim();
    if (dirtyFields.startDate) payload.startDate = new Date(`${data.startDate}T00:00:00`).toISOString();
    if (dirtyFields.endDate) payload.endDate = new Date(`${data.endDate}T23:59:59.999`).toISOString();
    if (dirtyFields.type) payload.type = data.type;
    if (dirtyFields.slots) payload.slots = Number(data.slots);
    if (dirtyFields.workloadHours) payload.workloadHours = data.workloadHours ? Number(data.workloadHours) : undefined;
    if (dirtyFields.area) payload.area = data.area;
    if (dirtyFields.campus) payload.campus = data.campus;

    if(dirtyFields.format){
      payload.format = data.format;

      if(data.format !== "ONLINE"){
        payload.address = {
          addressLine: data.address?.addressLine?.trim() ?? "",
          district: data.address?.district?.trim() ?? "",
          city: data.address?.city?.trim() ?? "",
          state: data.address?.state?.trim() ?? "",
          zipCode: data.address?.zipCode?.replace(/\D/g, "") ?? "",
        };
      }

      if(data.format !== "IN_PERSON"){
        payload.url = data.url?.trim() ?? "";
      }
    }
    else {
      if (dirtyFields.url && data.format !== "IN_PERSON") {
      payload.url = data.url?.trim();
    }

    if (dirtyFields.address && data.format !== "ONLINE") {
      const addressPayload: Record<string, unknown> = {};

      if (dirtyFields.address.addressLine) addressPayload.addressLine = data.address?.addressLine?.trim();
      if (dirtyFields.address.district) addressPayload.district = data.address?.district?.trim();
      if (dirtyFields.address.city) addressPayload.city = data.address?.city?.trim();
      if (dirtyFields.address.state) addressPayload.state = data.address?.state?.trim();
      if (dirtyFields.address.zipCode) addressPayload.zipCode = data.address?.zipCode?.replace(/\D/g, "") ?? "";

      if (Object.keys(addressPayload).length > 0) {
        payload.address = addressPayload;
      }
    }
    }
    
    if (Object.keys(payload).length === 0) {
      navigate(`/activity/${id}`);
      return;
    }
    
    try {
      await updateAction(id, payload as Partial<ActionEditSchemaType>);
      navigate(`/activity/${id}`);
    } catch (error) {
      handleActionApiErrors(
      error as Parameters<typeof handleActionApiErrors>[0],
      setError,
      setGeneralError,
      navigate
  );
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
      <DashboardShell
        header={<DashboardHeader onOpenRegister={() => {}} />}
        footer={<Footer />}
      >
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </DashboardShell>
    );
  }

  if (notFound) {
    return (
      <DashboardShell
        header={<DashboardHeader onOpenRegister={() => {}} />}
        footer={<Footer />}
      >
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-500">Ação não encontrada.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      header={<DashboardHeader onOpenRegister={() => {}} />}
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
          <TitleField
            registration={register("title")}
            error={errors.title?.message}
          />

          <DescriptionField
            registration={register("description")}
            error={errors.description?.message}
          />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DateField
                    label="Data de início"
                    registration={register("startDate")}
                    error={errors.startDate?.message}
                  />
                  <DateField
                    label="Data de encerramento"
                    registration={register("endDate")}                  
                    error={errors.endDate?.message}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ActionTypeField
                    registration={register("type")}
                    error={errors.type?.message}
                  />
                  <SlotsField
                    registration={register("slots")}
                    error={errors.slots?.message}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormatField
                    registration={register("format")}
                    error={errors.format?.message}
                  />
                  <WorkloadField
                    registration={register("workloadHours")}
                    error={errors.workloadHours?.message}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <AreaField
                    registration={register("area")}
                    error={errors.area?.message}
                  />
                  <UrlField
                    registration={register("url")}
                    error={errors.url?.message}
                  />
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
                  zipCodeValue={zipCodeValue}
                  onZipCodeChange={handleZipCodeChange}
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
                
                <CampusField
                  registration={register("campus")}
                  error={errors.campus?.message}
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
