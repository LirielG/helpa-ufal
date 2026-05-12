import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input, Button, Alert, Layout } from "../components";
import { useAuth } from "../hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LoginSchema } from "../validators/auth";
import helpaBlueLogo from "../assets/helpa-logo-blue.svg";

type LoginFields = {
  email: string;
  password: string;
};

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(LoginSchema),
    mode: "onSubmit"
  });

  const onSubmit = async (data: LoginFields) => {
    const success = await login(data);
    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-2 mb-8">
                <div className="shrink-0">
                <img src={helpaBlueLogo} alt="helpa" className="h-8 md:h-10 w-auto" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Bem vindo</h1>
            </div>

            {authError && (
              <div className="mb-6">
                <Alert type="error" message={authError} />
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Usuário"
                type="email"
                placeholder="seu.email@exemplo.com"
                icon={<Mail className="size-5" />}
                error={errors.email?.message}
                {...register("email")}
              />

              <div>
                <label className="block text-sm font-medium mb-2">Senha</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="size-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    className={`w-full pl-12 pr-12 py-3 border ${
                      errors.password
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300 focus:ring-blue-500"
                    } rounded-lg outline-none focus:ring-2 transition`}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 rounded border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Lembrar de mim</span>
                </label>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700">
                  Esqueci minha senha
                </a>
              </div>

              <Button
                type="submit"
                size="lg"
                isLoading={isLoading}
                variant="navy"
              >
                Entrar
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Não tem uma conta?{" "}
                <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  Criar conta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
