import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input, Button, Alert, Layout } from "../components";
import { useAuth, useFormErrors } from "../hooks";
import { validateLoginForm } from "../validators";

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();
  const { errors, setErrorsFromArray, clearError, clearAllErrors } = useFormErrors();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const validationErrors = validateLoginForm(formData.email, formData.password);

    if (validationErrors.length > 0) {
      setErrorsFromArray(validationErrors);
      return;
    }

    const success = await login(formData);

    if (success) {
      navigate("/dashboard");
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="size-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">H</span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Bem vindo</h1>
            </div>

            {authError && (
              <div className="mb-6">
                <Alert type="error" message={authError} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Usuário"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu.email@exemplo.com"
                icon={<Mail className="size-5" />}
                error={errors.email}
              />

              <div>
                <label className="block text-sm font-medium mb-2">Senha</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="size-5" />
                  </div>
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
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password}</p>
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
