import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "../components";
import { useAuth } from "../hooks";
import { DashboardShell } from "../features/dashboard/components/DashboardShell";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { Footer } from "../components/Footer";
import {
  TitleField,
  DescriptionField,
  DateField,
  ActionTypeField,
  SpotsField,
  ResponsibleCard,
} from "../features/action-edit/components";
import {
  ActionEditSchema,
  type ActionEditSchemaType,
} from "../features/action-edit/validators";
import { getActionById } from "../features/action-detail/services";
import { updateAction } from "../features/action-edit/services";
import {
  toInputDate,
  fromInputDate,
  categoryToActionType,
} from "../features/action-edit/utils";

export function EditAction() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [isLoadingAction, setIsLoadingAction] = useState(Boolean(id));
  const [loadFailed, setLoadFailed] = useState(false);
  const notFound = !id || loadFailed;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ActionEditSchema),
    mode: "onSubmit",
  });

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
        description: action.fullDescription,
        startDate: toInputDate(action.startDate),
        endDate: toInputDate(action.endDate),
        type: categoryToActionType(action.category),
        spots: action.totalSlots,
      });

      setIsLoadingAction(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [id, reset]);

  const onSubmit = async (data: ActionEditSchemaType) => {
    if (!id) return;

    await updateAction(id, {
      ...data,
      startDate: fromInputDate(data.startDate),
      endDate: fromInputDate(data.endDate),
    } as ActionEditSchemaType);

    navigate(`/activity/${id}`);
  };

  const responsible = {
    name: user?.fullName ?? "Nome Exemplo",
    email: user?.email ?? "meu.email@exemplo.com",
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
      <div className="max-w-10xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm px-6 pt-6 pb-6 md:px-10 md:pt-10 md:pb-6"
        >
          <TitleField
            registration={register("title")}
            error={errors.title?.message}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2">
              <DescriptionField
                registration={register("description")}
                error={errors.description?.message}
              />
            </div>

            <div className="flex flex-col gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <ActionTypeField
                  registration={register("type")}
                  error={errors.type?.message}
                />
                <SpotsField
                  registration={register("spots")}
                  error={errors.spots?.message}
                />
              </div>

              <ResponsibleCard responsible={responsible} />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="navy"
                  isLoading={isSubmitting}
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
