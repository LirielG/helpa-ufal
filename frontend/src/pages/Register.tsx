import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  User,
  GraduationCap,
  Mail,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input, Button, Select, Alert, Tooltip, Layout } from "../components";
import { useAuth } from "../hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { RegisterSchema } from "../validators/auth";
import type { UserType, RegisterRequest } from "../types";

interface TypeConfig {
  color: string;
  icon: LucideIcon;
  title: string;
}

const defaultFields = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  institution: "",
  cndbNumber: "",
  course: "",
  enrollment: "",
};

type RegisterFields = typeof defaultFields & { userType: UserType };

export function Register() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error: authError } = useAuth();
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const typeConfig: Record<UserType, TypeConfig> = {
    student: {
      color: "blue",
      icon: GraduationCap,
      title: "Cadastro de Aluno",
    },
    teacher: {
      color: "green",
      icon: User,
      title: "Cadastro de Docente",
    },
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<RegisterFields>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { ...defaultFields, userType: selectedType ?? "student" },
    mode: "onSubmit"
  });

  const onSubmit = async (data: RegisterFields) => {
    // RHF já garante os campos obrigatórios
    const payload: RegisterRequest = {
      ...data,
      type: selectedType as UserType,
    };
    const success = await registerUser(payload);
    if (success) {
      navigate("/dashboard");
    }
  };

  // Troca o tipo de perfil, limpando o form
  const selectProfile = (type: UserType) => {
    setSelectedType(type);
    reset({ ...defaultFields, userType: type });
  };

  if (!selectedType) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">Criar conta no helpa</h1>
            <p className="text-xl text-gray-600">
              Escolha o tipo de perfil que melhor se adequa a você!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {( ["teacher", "student"] as const).map((type) => {
              const config = typeConfig[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => selectProfile(type)}
                  className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
                >
                  <div
                    className={`size-20 ${
                      config.color === "green"
                        ? "bg-green-100 group-hover:bg-green-600"
                        : "bg-blue-100 group-hover:bg-blue-600"
                    } rounded-full flex items-center justify-center mx-auto mb-6 transition`}
                  >
                    <Icon
                      className={`size-10 ${
                        config.color === "green"
                          ? "text-green-600 group-hover:text-white"
                          : "text-blue-600 group-hover:text-white"
                      } transition`}
                    />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-gray-900">
                    {type === "teacher" ? "Docente" : "Estudante"}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {type === "teacher"
                      ? "Professor ou pesquisador criando e gerenciando ações de extensão."
                      : "Estudante universitário interessado em participar das ações."}
                  </p>
                  <div
                    className={`font-medium ${
                      config.color === "green"
                        ? "text-green-600 group-hover:text-green-700"
                        : "text-blue-600 group-hover:text-blue-700"
                    }`}
                  >
                    Criar →
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600">
              Já possiu uma conta no helpa?{" "}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const config = typeConfig[selectedType];
  const Icon = config.icon;
  return (
    <Layout>
      <div className="max-w-[760px] mx-auto">
        <button
          onClick={() => setSelectedType(null)}
          className="mb-6 text-gray-600 hover:text-gray-900 transition font-medium"
        >
          ← Voltar para a Seleção de Cadastro
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div
              className={`size-14 ${
                config.color === "blue"
                  ? "bg-blue-100"
                  : config.color === "green"
                  ? "bg-green-100"
                  : "bg-purple-100"
              } rounded-full flex items-center justify-center`}
            >
              <Icon
                className={`size-7 ${
                  config.color === "blue"
                    ? "text-blue-600"
                    : config.color === "green"
                    ? "text-green-600"
                    : "text-purple-600"
                }`}
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{config.title}</h1>
            </div>
          </div>

          {authError && (
            <div className="mb-6">
              <Alert type="error" message={authError} />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Nome completo"
              type="text"
              placeholder="Digite seu nome completo"
              error={errors.name?.message}
              {...register("name")}
            />

            <Input
              label="Email"
              type="email"
              placeholder="seu.email@exemplo.com"
              error={errors.email?.message}
              {...register("email")}
            />

            {selectedType === "teacher" && (
              <>
                <Controller
                  control={control}
                  name="institution"
                  render={({ field }) => (
                    <Input
                      label="Instituição"
                      placeholder="Nome da instituição"
                      error={errors.institution?.message}
                      {...field}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="cndbNumber"
                  render={({ field }) => (
                    <Input
                      label="CNDB"
                      placeholder="Ex.: Ciência da Computação"
                      error={errors.cndbNumber?.message}
                      labelIcon={
                        <Tooltip content="A CNDB é a Carteira Nacional Docente do Brasil, documento oficial do Ministério da Educação (MEC) que identifica e valoriza professores da educação básica e superior (pública ou privada) em todo o país. Ela facilita a comprovação do vínculo profissional, garantindo benefícios, descontos culturais e reconhecimento formal da profissão" />
                      }
                      {...field}
                    />
                  )}
                />
              </>
            )}

            {selectedType === "student" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={control}
                  name="course"
                  render={({ field }) => (
                    <Input
                      label="Curso"
                      placeholder="Ex.: Ciência da Computação"
                      error={errors.course?.message}
                      {...field}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="enrollment"
                  render={({ field }) => (
                    <Input
                      label="Código de matrícula"
                      placeholder="Número de matrícula"
                      error={errors.enrollment?.message}
                      {...field}
                    />
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div>
                  <label className="block text-sm font-medium mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      className={`w-full px-4 py-3 border ${
                        errors.password
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      } rounded-lg outline-none focus:ring-2 transition pr-12`}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(current => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Confirmar senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite a senha novamente"
                      className={`w-full px-4 py-3 border ${
                        errors.confirmPassword
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      } rounded-lg outline-none focus:ring-2 transition pr-12`}
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(current => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 flex items-start">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">A senha deve conter:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Pelo menos 8 caracteres</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Uma letra maiúscula</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Uma letra minúscula</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Um caractere especial (Ex: @, $, *, _)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" isLoading={isLoading} variant="navy">
              Criar conta
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Ao criar uma conta você concorda com nossos{" "}
              <Link to="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Termos de uso
              </Link>
              {" "}e{" "}
              <Link to="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Política de Privacidade
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
