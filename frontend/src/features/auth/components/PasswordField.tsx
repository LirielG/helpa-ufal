import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff, Lock } from "lucide-react";

type PasswordFieldProps = {
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  showPassword: boolean;
  onTogglePassword: () => void;
  placeholder?: string;
};

export function PasswordField({
  label,
  error,
  registration,
  showPassword,
  onTogglePassword,
  placeholder = "Digite sua senha",
}: PasswordFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Lock className="size-5" />
        </div>
        <input
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          className={`w-full pl-12 pr-12 py-3 border ${
            error ? "border-red-300 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
          } rounded-lg outline-none focus:ring-2 transition`}
          {...registration}
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}