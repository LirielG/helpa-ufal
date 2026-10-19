import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { Alert, Button, Input } from "../../../components";
import { PasswordField } from "../../auth/components/PasswordField";
import { PasswordGuidelines } from "../../auth/components/PasswordGuidelines";
import { AuthField } from "../../auth/components/AuthField";
import {
  EditProfileSchema,
  type EditProfileFields,
} from "../../../validators/profile";
import type { UpdateProfileRequest } from "../../../types";
import type { UserProfile } from "../types";
import { getInitials } from "../../../utils/helpers";
import { handleProfileApiErrors } from "../handleProfileApiErrors";

const USER_TYPE_LABELS: Record<UserProfile["userType"], string> = {
  STUDENT: "Estudante",
  TEACHER: "Docente",
};

type Feedback = { type: "error" | "success" | "info"; message: string };

type PersonalDataFormProps = {
  user: UserProfile;
  /** Saves the changes; rejects with the API error when the save fails. */
  onSave: (data: UpdateProfileRequest) => Promise<void>;
  onLogout: () => void;
};

export function PersonalDataForm({
  user,
  onSave,
  onLogout,
}: PersonalDataFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileFields>({
    resolver: zodResolver(EditProfileSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: user.fullName,
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const newPasswordValue = useWatch({ control, name: "newPassword" }) ?? "";

  const submit = handleSubmit(async (data) => {
    setFeedback(null);

    // The API answers 400 to a body without changes, and rejects fields it
    // does not let the user edit, so only what changed is sent.
    const changes: UpdateProfileRequest = {};
    // The schema trims the typed name, so the stored one is trimmed too before
    // comparing: a stray space saved long ago is not a change the user made.
    if (data.fullName !== user.fullName.trim())
      changes.fullName = data.fullName;
    if (data.newPassword) {
      changes.currentPassword = data.currentPassword;
      changes.newPassword = data.newPassword;
    }

    if (Object.keys(changes).length === 0) {
      setFeedback({ type: "info", message: "Nenhuma alteração para salvar." });
      return;
    }

    try {
      await onSave(changes);
      setFeedback({
        type: "success",
        message: "Perfil atualizado com sucesso.",
      });
    } catch (error) {
      const message = handleProfileApiErrors(error, setError);
      if (message) setFeedback({ type: "error", message });
    }
  });

  const initials = getInitials(user.fullName) || "P";

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <h3 className="text-xl font-bold text-gray-900">Editar Perfil</h3>

      {feedback && (
        <Alert
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
        <div className="flex justify-center md:justify-start md:pt-2">
          <div className="size-28 rounded-full bg-[#3B82F6] text-white flex items-center justify-center font-medium text-3xl leading-none shrink-0 select-none">
            <span>{initials}</span>
          </div>
        </div>

        <div className="space-y-5">
          <AuthField
            label="Nome completo"
            placeholder="Nome Exemplo"
            error={errors.fullName?.message}
            registration={register("fullName")}
          />

          <Input label="Email" value={user.email} disabled readOnly />

          <Input
            label="Tipo de perfil"
            value={USER_TYPE_LABELS[user.userType]}
            disabled
            readOnly
          />

          <Input
            label="Matrícula"
            value={user.registrationCode ?? ""}
            disabled
            readOnly
          />

          <Input label="Curso" value={user.course ?? ""} disabled readOnly />

          <div className="space-y-5 pt-2">
            <h4 className="text-base font-semibold text-gray-900">
              Alterar senha
            </h4>

            <PasswordField
              label="Senha atual"
              placeholder="********"
              error={errors.currentPassword?.message}
              registration={register("currentPassword")}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
            />

            <PasswordField
              label="Nova senha"
              placeholder="********"
              error={errors.newPassword?.message}
              registration={register("newPassword")}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
            />

            <PasswordGuidelines password={newPasswordValue} />

            <PasswordField
              label="Confirmar nova senha"
              placeholder="********"
              error={errors.confirmNewPassword?.message}
              registration={register("confirmNewPassword")}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Button type="submit" variant="navy" size="md" isLoading={isSubmitting}>
          Salvar alterações
        </Button>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="size-5" />
          SAIR
        </button>
      </div>
    </form>
  );
}
