import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "../../../components";

type AuthFieldProps = {
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  icon?: React.ReactNode;
  labelIcon?: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  maxLength?: number;
  className?: string;
};

export function AuthField({
  label,
  error,
  registration,
  icon,
  labelIcon,
  type = "text",
  placeholder,
  autoComplete,
  autoCapitalize,
  spellCheck,
  maxLength,
  className,
}: AuthFieldProps) {
  return (
    <Input
      label={label}
      error={error}
      icon={icon}
      labelIcon={labelIcon}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      maxLength={maxLength}
      className={className}
      {...registration}
    />
  );
}
