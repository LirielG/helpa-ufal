import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "../../../components";

type PasswordFieldProps = {
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  showPassword: boolean;
  onTogglePassword: () => void;
  placeholder?: string;
  id?: string;
  autoComplete?: string;
};

export function PasswordField({
  label,
  error,
  registration,
  showPassword,
  onTogglePassword,
  placeholder = "Digite sua senha",
  id,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <Input
      id={id}
      autoComplete={autoComplete}
      label={label}
      error={error}
      placeholder={placeholder}
      type={showPassword ? "text" : "password"}
      icon={<Lock className="size-5" />}
      trailing={
        <button
          type="button"
          onClick={onTogglePassword}
          className="text-gray-400 hover:text-gray-600 transition"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? (
            <EyeOff className="size-5" />
          ) : (
            <Eye className="size-5" />
          )}
        </button>
      }
      {...registration}
    />
  );
}
