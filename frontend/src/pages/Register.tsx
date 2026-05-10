import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  User,
  GraduationCap,
  Users as UsersIcon,
  Mail,
  Lock,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input, Button, Select, Alert, Tooltip, Layout } from "../components";
import { useAuth, useFormErrors } from "../hooks";
import { validateRegisterForm } from "../validators";
import type { UserType, RegisterRequest } from "../types";

interface TypeConfig {
  color: string;
  icon: LucideIcon;
  title: string;
}

export function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuth();
  const { errors, setErrorsFromArray, clearError, clearAllErrors } = useFormErrors();

  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    institution: "",
    cndbNumber: "",
    course: "",
    enrollment: "",
  });

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
    external: {
      color: "purple",
      icon: UsersIcon,
      title: "Cadastro de Público Externo",
    },
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    clearError(name);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();

    if (!selectedType) {
      alert("Selecione um tipo de perfil");
      return;
    }

    const validationErrors = validateRegisterForm({
      ...formData,
      userType: selectedType,
    });

    if (validationErrors.length > 0) {
      setErrorsFromArray(validationErrors);
      return;
    }

    const requestData: RegisterRequest = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      type: selectedType,
    };

    if (selectedType === "student") {
      requestData.institution = formData.institution;
      requestData.course = formData.course;
      requestData.enrollment = formData.enrollment;
    }

    if (selectedType === "teacher") {
      requestData.institution = formData.institution;
      requestData.cndbNumber = formData.cndbNumber;
    }

    const success = await register(requestData);

    if (success) {
      navigate("/dashboard");
    }
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
            {(["teacher", "external"] as const).map((type) => {
              const config = typeConfig[type];
              const Icon = config.icon;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
                >
                  <div
                    className={`size-20 ${
                      config.color === "green"
                        ? "bg-green-100 group-hover:bg-green-600"
                        : "bg-purple-100 group-hover:bg-purple-600"
                    } rounded-full flex items-center justify-center mx-auto mb-6 transition`}
                  >
                    <Icon
                      className={`size-10 ${
                        config.color === "green"
                          ? "text-green-600 group-hover:text-white"
                          : "text-purple-600 group-hover:text-white"
                      } transition`}
                    />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-gray-900">
                    {type === "teacher"
                      ? "Docente"
                      : "Público Externo"}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {type === "teacher"
                      ? "Professor ou pesquisador criando e gerenciando ações de extensão."
                      : "Membro da comunidade interessado em participar das ações."}
                  </p>
                  <div
                    className={`font-medium ${
                      config.color === "green"
                        ? "text-green-600 group-hover:text-green-700"
                        : "text-purple-600 group-hover:text-purple-700"
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nome completo"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Digite seu nome completo"
              icon={<User className="size-5" />}
              error={errors.name}
            />

            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu.email@exemplo.com"
              icon={<Mail className="size-5" />}
              error={errors.email}
            />

            {selectedType === "teacher" && (
              <>
                <Select
                  label="Instituição"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  icon={<Building2 className="size-5" />}
                  error={errors.institution}
                  options={[
                    { value: "", label: "Selecione sua instituição" },
                    { value: "UFAL", label: "UFAL" },
                    { value: "UFRN", label: "UFRN" },
                    { value: "UFPB", label: "UFPB" },
                    { value: "UFERSA", label: "UFERSA" },
                  ]}
                />

                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <label className="block text-sm font-medium">CNDB</label>
                    <Tooltip content="A CNDB é a Carteira Nacional Docente do Brasil, documento oficial do Ministério da Educação (MEC) que identifica e valoriza professores da educação básica e superior (pública ou privada) em todo o país. Ela facilita a comprovação do vínculo profissional, garantindo benefícios, descontos culturais e reconhecimento formal da profissão" />
                  </div>
                  <input
                    type="text"
                    name="cndbNumber"
                    value={formData.cndbNumber}
                    onChange={handleChange}
                    placeholder="Ex.: Ciência da Computação"
                    className={`w-full px-4 py-2.5 border ${
                      errors.cndbNumber
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:ring-blue-500"
                    } rounded-lg outline-none focus:ring-2 transition text-sm`}
                  />
                  {errors.cndbNumber && (
                    <p className="text-red-500 text-sm mt-1">{errors.cndbNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-4 items-start">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Digite sua senha"
                          className={`w-full pl-12 pr-12 py-3 border ${
                            errors.password
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-300 focus:ring-blue-500"
                          } rounded-lg outline-none focus:ring-2 transition`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Confirmar senha</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Digite a senha novamente"
                          className={`w-full pl-12 pr-12 py-3 border ${
                            errors.confirmPassword
                              ? "border-red-300 focus:ring-red-500"
                              : "border-gray-300 focus:ring-blue-500"
                          } rounded-lg outline-none focus:ring-2 transition`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 text-sm text-gray-500">
                    <p className="mb-2 text-gray-700">A senha deve conter:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Pelo menos 8 caracteres</li>
                      <li>Uma letra maiúscula</li>
                      <li>Uma letra minúscula</li>
                      <li>Um caracter especial (Ex: @,$,*,_)</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {selectedType !== "teacher" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Digite sua senha"
                      className={`w-full pl-12 pr-12 py-3 border ${
                        errors.password
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      } rounded-lg outline-none focus:ring-2 transition`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirme sua senha"
                      className={`w-full pl-12 pr-12 py-3 border ${
                        errors.confirmPassword
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      } rounded-lg outline-none focus:ring-2 transition`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="size-4 rounded border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-600">Ver senhas</span>
            </label>

            <Button type="submit" size="lg" isLoading={isLoading} variant="navy">
              Criar conta
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
