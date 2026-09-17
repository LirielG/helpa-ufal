import React from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

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
  zipCodeValue?: string;
  onZipCodeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AddressBlock({
  addressLineRegistration,
  districtRegistration,
  zipCodeRegistration,
  cityRegistration,
  stateRegistration,
  disabled = false,
  errors = {},
  zipCodeValue,
  onZipCodeChange,
}: AddressBlockProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-gray-700">Logradouro</label>
        <input
          type="text"
          placeholder="Rua Dois, S/N"
          disabled={disabled}
          className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-100 placeholder-gray-400 ${
            errors.addressLine ? "border-red-300" : "border-gray-200"
          }`}
          {...addressLineRegistration}
        />
        {errors.addressLine && (
          <p className="text-sm text-red-600 px-1">{errors.addressLine}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Bairro</label>
          <input
            type="text"
            placeholder="Bairro Jardim"
            disabled={disabled}
            className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-100 placeholder-gray-400 ${
              errors.district ? "border-red-300" : "border-gray-200"
            }`}
            {...districtRegistration}
          />
          {errors.district && (
            <p className="text-sm text-red-600 px-1">{errors.district}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">CEP</label>
          <input
            type="text"
            maxLength={9}
            placeholder="00000-000"
            disabled={disabled}
            value={zipCodeValue !== undefined ? zipCodeValue : undefined}
            className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-100 placeholder-gray-400 ${
              errors.zipCode ? "border-red-300" : "border-gray-200"
            }`}
            {...zipCodeRegistration}
            onChange={(e) => {
              zipCodeRegistration.onChange(e);
              if (onZipCodeChange) onZipCodeChange(e);
            }}
          />
          {errors.zipCode && (
            <p className="text-sm text-red-600 px-1">{errors.zipCode}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Cidade</label>
          <input
            type="text"
            placeholder="Arapiraca"
            disabled={disabled}
            className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-100 placeholder-gray-400 ${
              errors.city ? "border-red-300" : "border-gray-200"
            }`}
            {...cityRegistration}
          />
          {errors.city && (
            <p className="text-sm text-red-600 px-1">{errors.city}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Estado</label>
          <input
            type="text"
            maxLength={2}
            placeholder="AL"
            disabled={disabled}
            className={`w-full px-2 py-2.5 text-xs text-gray-700 uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-100 placeholder-gray-400 ${
              errors.state ? "border-red-300" : "border-gray-200"
            }`}
            {...stateRegistration}
          />
          {errors.state && (
            <p className="text-sm text-red-600 px-1">{errors.state}</p>
          )}
        </div>
      </div>
    </div>
  );
}