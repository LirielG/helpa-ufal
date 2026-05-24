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
};

export function AuthField({
  label,
  error,
  registration,
  icon,
  labelIcon,
  type = "text",
  placeholder,
}: AuthFieldProps) {
  return (
    <Input
      label={label}
      error={error}
      icon={icon}
      labelIcon={labelIcon}
      type={type}
      placeholder={placeholder}
      {...registration}
    />
  );
}