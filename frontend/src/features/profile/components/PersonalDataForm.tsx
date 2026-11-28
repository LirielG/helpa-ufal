import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Input } from "../../../components";
import { PasswordField } from "../../auth/components/PasswordField";
import { PasswordGuidelines } from "../../auth/components/PasswordGuidelines";
import { AuthField } from "../../auth/components/AuthField";
import {
  editProfileSchemaFor,
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
};

export function PersonalDataForm({ user, onSave }: PersonalDataFormProps) {
  // The current password has its own toggle: checking what was typed in the
  // new one must not put the current one on screen too.
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const headingId = useId();
  // `isSubmitting` goes back to false when a second submit returns early, with
  // the first request still pending, so the button follows its own state. The
  // ref blocks a second submit before that state has rendered.
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  const schemaResolver = zodResolver(editProfileSchemaFor(user.fullName));

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileFields>({
    resolver: (values, context, options) =>
      schemaResolver(
        values.newPassword || values.confirmNewPassword
          ? values
          : { ...values, currentPassword: "" },
        context,
        options,
      ),
    mode: "onSubmit",
    defaultValues: {
      fullName: user.fullName,
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const [fullName, newPassword, confirmNewPassword] = useWatch({
    control,
    name: ["fullName", "newPassword", "confirmNewPassword"],
  });

  // The name is compared trimmed, as the submit does, so a stray space is not
  // a change the user made. The current password alone is not a change either
  // (see the resolver above).
  const hasChanges =
    (fullName ?? "").trim() !== user.fullName.trim() ||
    Boolean(newPassword || confirmNewPassword);

  const onValidSubmit = async (data: EditProfileFields) => {
    if (isSendingRef.current) return;

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

    isSendingRef.current = true;
    setIsSending(true);
    try {
      await onSave(changes);
      setFeedback({
        type: "success",
        message: "Perfil atualizado com sucesso.",
      });
    } catch (error) {
      const message = handleProfileApiErrors(error, setError);
      if (message) setFeedback({ type: "error", message });
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const initials = getInitials(user.fullName) || "P";

  return (
    <form
      onSubmit={(event) => void handleSubmit(onValidSubmit)(event)}
      aria-labelledby={headingId}
      className="space-y-6"
      noValidate
    >
      {feedback && (
        <Alert
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-6 md:gap-x-12 items-start">
        <div className="flex flex-col items-center md:items-start gap-6">
          <h2
            id={headingId}
            className="text-xl md:text-2xl font-bold text-[#000A1E]"
          >
            Editar Perfil
          </h2>

          <div
            aria-hidden="true"
            className="size-28 md:size-44 rounded-full bg-[#002147] text-white flex items-center justify-center font-bold text-4xl md:text-6xl leading-none shrink-0 select-none"
          >
            <span>{initials}</span>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <AuthField
            label="Nome completo"
            placeholder="Nome Exemplo"
            error={errors.fullName?.message}
            registration={register("fullName")}
          />

          <Input label="Email" value={user.email} disabled readOnly />

          <Input
            label="Matrícula"
            value={user.registrationCode ?? ""}
            disabled
            readOnly
          />

          <Input label="Curso" value={user.course ?? ""} disabled readOnly />

          <Input
            label="Tipo de conta"
            value={USER_TYPE_LABELS[user.userType]}
            disabled
            readOnly
          />

          <fieldset className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 min-w-0 border-0 p-0 m-0">
            <legend className="sr-only">Alterar senha</legend>

            <div className="min-w-0 lg:col-start-1">
              <PasswordField
                label="Senha atual"
                placeholder="********"
                error={errors.currentPassword?.message}
                registration={register("currentPassword")}
                showPassword={showCurrentPassword}
                onTogglePassword={() =>
                  setShowCurrentPassword((value) => !value)
                }
              />
            </div>

            <div className="min-w-0 lg:col-start-1">
              <PasswordField
                label="Nova senha"
                placeholder="********"
                error={errors.newPassword?.message}
                registration={register("newPassword")}
                showPassword={showNewPassword}
                onTogglePassword={() => setShowNewPassword((value) => !value)}
              />
            </div>

            {/* Beside the fields on wide screens, between "Nova senha" and
                the confirmation on narrow ones. */}
            <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:pt-8">
              <PasswordGuidelines password={newPassword ?? ""} />
            </div>

            <div className="min-w-0 lg:col-start-1">
              <PasswordField
                label="Confirmação da senha"
                placeholder="********"
                error={errors.confirmNewPassword?.message}
                registration={register("confirmNewPassword")}
                showPassword={showNewPassword}
                onTogglePassword={() => setShowNewPassword((value) => !value)}
              />
            </div>
          </fieldset>
        </div>
      </div>

      <div className="flex justify-end [&>button]:w-full sm:[&>button]:w-auto">
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting || isSending}
          disabled={isSubmitting || isSending || !hasChanges}
        >
          Salvar Alterações
        </Button>
      </div>
    </form>
  );
}
