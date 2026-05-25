import { useState } from "react";
import { useNavigate } from "react-router";
import { Mail } from "lucide-react";
import { Button, Alert } from "../components";
import { useAuth } from "../hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LoginSchema } from "../validators/auth";
import helpaBlueLogo from "../assets/helpa-logo-blue.svg";
import { AuthField } from "../features/auth/components/AuthField";
import { AuthFooterLink } from "../features/auth/components/AuthFooterLink";
import { AuthShell } from "../features/auth/components/AuthShell";
import { PasswordField } from "../features/auth/components/PasswordField";

type LoginFields = {
  email: string;
  password: string;
};

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

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
    <AuthShell
      header={
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <img src={helpaBlueLogo} alt="helpa" className="h-8 md:h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Bem vindo</h1>
        </div>
      }
      footer={<AuthFooterLink prefix="Não tem uma conta?" linkText="Criar conta" to="/register" />}
    >
      {authError && (
        <div className="mb-6">
          <Alert type="error" message={authError} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          label="Usuário"
          type="email"
          placeholder="seu.email@exemplo.com"
          icon={<Mail className="size-5" />}
          error={errors.email?.message}
          registration={register("email")}
        />

        <PasswordField
          label="Senha"
          error={errors.password?.message}
          registration={register("password")}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((current) => !current)}
        />

        <Button type="submit" size="lg" isLoading={isLoading} variant="navy">
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
