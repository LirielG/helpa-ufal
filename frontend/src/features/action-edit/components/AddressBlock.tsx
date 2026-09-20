import type { ChangeHandler, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "../../../components";

interface AddressBlockProps {
  addressLineRegistration: UseFormRegisterReturn;
  districtRegistration: UseFormRegisterReturn;
  zipCodeRegistration: UseFormRegisterReturn;
  cityRegistration: UseFormRegisterReturn;
  stateRegistration: UseFormRegisterReturn;
  disabled?: boolean;
  errors?: {
    addressLine?: string;
    district?: string;
    zipCode?: string;
    city?: string;
    state?: string;
  };
}

function maskZipCode(value: string): string {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{5})(\d)/, "$1-$2")
    .slice(0, 9);
}

/** The API takes the two-letter abbreviation, so uppercase the value itself. */
function maskState(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Formats the typed value in place, so react-hook-form reads it back already
 * masked and the field stays uncontrolled.
 */
function withMask(
  registration: UseFormRegisterReturn,
  mask: (value: string) => string,
): UseFormRegisterReturn {
  const onChange: ChangeHandler = (event) => {
    event.target.value = mask(event.target.value);
    return registration.onChange(event);
  };

  return { ...registration, onChange };
}

export function AddressBlock({
  addressLineRegistration,
  districtRegistration,
  zipCodeRegistration,
  cityRegistration,
  stateRegistration,
  disabled = false,
  errors = {},
}: AddressBlockProps) {
  return (
    <div className="space-y-4">
      <Input
        size="sm"
        label="Logradouro"
        placeholder="Rua Dois, S/N"
        disabled={disabled}
        error={errors.addressLine}
        {...addressLineRegistration}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          size="sm"
          label="Bairro"
          placeholder="Bairro Jardim"
          disabled={disabled}
          error={errors.district}
          {...districtRegistration}
        />

        <Input
          size="sm"
          label="CEP"
          placeholder="00000-000"
          maxLength={9}
          disabled={disabled}
          error={errors.zipCode}
          {...withMask(zipCodeRegistration, maskZipCode)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          size="sm"
          label="Cidade"
          placeholder="Arapiraca"
          disabled={disabled}
          error={errors.city}
          {...cityRegistration}
        />

        <Input
          size="sm"
          label="Estado"
          placeholder="AL"
          maxLength={2}
          disabled={disabled}
          error={errors.state}
          {...withMask(stateRegistration, maskState)}
        />
      </div>
    </div>
  );
}
