import { useState } from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import { Button, Alert, Tooltip } from "../components";
import { useAuth } from "../hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { RegisterSchema } from "../validators/auth";
import type { RegisterRequest } from "../types";
import { AuthField } from "../features/auth/components/AuthField";
import { AuthFooterLink } from "../features/auth/components/AuthFooterLink";
import { AuthShell } from "../features/auth/components/AuthShell";
import { PasswordField } from "../features/auth/components/PasswordField";
import PasswordGuidelines from "../features/auth/components/PasswordGuidelines";
import { ProfileSelector } from "../features/auth/components/ProfileSelector";
import { PROFILE_OPTIONS } from "../features/auth/constants/profileOptions";
import type { ProfileType } from "../features/auth/types";

const defaultFields = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  course: "",
  registrationCode: "",
  cndb: "",
};

type RegisterFields = z.infer<typeof RegisterSchema>;

export function Register() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error: authError } = useAuth();
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<RegisterFields>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { ...defaultFields, userType: selectedType ?? "student" } as RegisterFields,
    mode: "onSubmit"
  });

  const onSubmit = async (data: RegisterFields) => {
    const payload: RegisterRequest = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      userType: data.userType === "student" ? "STUDENT" : "TEACHER",
      course: data.course,
      registrationCode: data.registrationCode,
      ...(data.userType === "teacher" ? { cndb: data.cndb } : {}),
    };
    const success = await registerUser(payload);
    if (success) {
      navigate("/dashboard");
    }
  };

  const selectProfile = (type: ProfileType) => {
    setSelectedType(type);
    reset({ ...defaultFields, userType: type } as RegisterFields);
  };

  if (!selectedType) {
    return (
      <AuthShell
        maxWidthClassName="max-w-4xl"
        header={
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">Criar conta no helpa</h1>
            <p className="text-xl text-gray-600">
              Escolha o tipo de perfil que melhor se adequa a você!
            </p>
          </div>
        }
        footer={<AuthFooterLink prefix="Já possui uma conta no helpa?" linkText="Entrar" to="/login" />}
      >
        <ProfileSelector selectedType={selectedType} onSelect={selectProfile} />
      </AuthShell>
    );
  }

  const cndbError = (errors as { cndb?: { message?: string } }).cndb?.message;
  const selectedProfile = PROFILE_OPTIONS.find((option) => option.type === selectedType);
  return (
    <AuthShell
      maxWidthClassName="max-w-[760px]"
      header={
        <button
          onClick={() => setSelectedType(null)}
          className="text-gray-600 hover:text-gray-900 transition font-medium cursor-pointer"
        >
          ← Voltar para a Seleção de Cadastro
        </button>
      }
      footer={<AuthFooterLink prefix="Já possui uma conta no helpa?" linkText="Entrar" to="/login" />}
    >
      <div className="flex items-center gap-4 mb-8">
        <div
          className={`size-14 rounded-full flex items-center justify-center ${
            selectedProfile?.color === "green" ? "bg-green-100" : "bg-blue-100"
          }`}
        >
          <span
            className={`font-semibold text-xl ${
              selectedProfile?.color === "green" ? "text-green-600" : "text-blue-600"
            }`}
          >
            {selectedProfile?.title?.[0] ?? "?"}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {selectedProfile?.title ? `Cadastro de ${selectedProfile.title}` : "Cadastro"}
          </h1>
        </div>
      </div>

      {authError && (
        <div className="mb-6">
          <Alert type="error" message={authError} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          label="Nome completo"
          type="text"
          placeholder="Digite seu nome completo"
          error={errors.fullName?.message}
          registration={register("fullName")}
        />

        <AuthField
          label="Email"
          type="email"
          placeholder="seu.email@exemplo.com"
          error={errors.email?.message}
          registration={register("email")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AuthField
            label="Curso"
            placeholder="Ex.: Ciência da Computação"
            error={errors.course?.message}
            registration={register("course")}
          />
          <AuthField
            label="Código de matrícula"
            placeholder="Número de matrícula"
            error={errors.registrationCode?.message}
            registration={register("registrationCode")}
          />
        </div>

        {selectedType === "teacher" && (
          <AuthField
            label="CNDB"
            placeholder="Ex.: Número da carteira docente"
            error={cndbError}
            labelIcon={
              <Tooltip content="A CNDB é a Carteira Nacional Docente do Brasil, documento oficial do Ministério da Educação (MEC) que identifica e valoriza professores da educação básica e superior (pública ou privada) em todo o país. Ela facilita a comprovação do vínculo profissional, garantindo benefícios, descontos culturais e reconhecimento formal da profissão" />
            }
            registration={register("cndb")}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <PasswordField
              label="Senha"
              error={errors.password?.message}
              registration={register("password")}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
            />


            <div className="mt-4">
              <PasswordField
                label="Confirmar senha"
                placeholder="Digite a senha novamente"
                error={errors.confirmPassword?.message}
                registration={register("confirmPassword")}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((current) => !current)}
              />
            </div>
          </div>

          <PasswordGuidelines password={watch('password') ?? ''} />
        </div>

        <Button type="submit" size="lg" isLoading={isLoading} variant="navy">
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
