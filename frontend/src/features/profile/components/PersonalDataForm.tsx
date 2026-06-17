import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Pencil } from "lucide-react";
import { Alert, Button, Input } from "../../../components";
import { PasswordField } from "../../auth/components/PasswordField";
import { PasswordGuidelines } from "../../auth/components/PasswordGuidelines";
import { AuthField } from "../../auth/components/AuthField";
import {
  EditProfileSchema,
  type EditProfileFields,
} from "../../../validators/profile";
import type { UpdateProfileRequest, User } from "../../../types";

type PersonalDataFormProps = {
  user: User;
  onSubmit: (data: UpdateProfileRequest) => Promise<void>;
  onLogout: () => void;
  isSaving: boolean;
  error: string | null;
  success: boolean;
  onDismissFeedback: () => void;
};

export function PersonalDataForm({
  user,
  onSubmit,
  onLogout,
  isSaving,
  error,
  success,
  onDismissFeedback,
}: PersonalDataFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    user.avatarUrl,
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitted },
  } = useForm<EditProfileFields>({
    resolver: zodResolver(EditProfileSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      password: "",
    },
  });

  const passwordValue = useWatch({ control, name: "password" }) ?? "";

  const submit = handleSubmit((data) => {
    return onSubmit({
      fullName: data.fullName,
      email: data.email,
      password: data.password?.trim() ? data.password : undefined,
    });
  });

  // Avatar upload is a local preview only until the upload API is ready.
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Editar Perfil</h3>

      {error && (
        <Alert type="error" message={error} onClose={onDismissFeedback} />
      )}
      {success && (
        <Alert
          type="success"
          message="Perfil atualizado com sucesso."
          onClose={onDismissFeedback}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start">
        <div className="flex justify-center md:justify-start md:pt-2">
          <div className="relative">
            <div className="size-32 rounded-full bg-gray-200 overflow-hidden">
              {avatarPreview && (
                <img
                  src={avatarPreview}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2 rounded-full bg-blue-100 text-[#072C59] ring-4 ring-white hover:bg-blue-200 transition cursor-pointer"
              aria-label="Alterar foto de perfil"
            >
              <Pencil className="size-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        <div className="space-y-5">
          <AuthField
            label="Nome completo"
            placeholder="Nome Exemplo"
            error={errors.fullName?.message}
            registration={register("fullName")}
          />

          <AuthField
            label="Email"
            type="email"
            placeholder="meu.email@exemplo.com"
            error={errors.email?.message}
            registration={register("email")}
          />

          <PasswordField
            label="Senha"
            placeholder="********"
            error={isSubmitted ? errors.password?.message : undefined}
            registration={register("password")}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
          />

          <PasswordGuidelines password={passwordValue} />

          <Input
            label="Matrícula"
            value={user.registrationCode ?? ""}
            disabled
            readOnly
          />

          <Input label="Curso" value={user.course ?? ""} disabled readOnly />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Button type="submit" variant="navy" size="md" isLoading={isSaving}>
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
