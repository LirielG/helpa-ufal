import { ChevronDown } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { ACTION_TYPES } from "../../dashboard/constants";

interface ActionTypeFieldProps {
  registration: UseFormRegisterReturn;
  error?: string;
}

export function ActionTypeField({ registration, error }: ActionTypeFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-700">Tipo de ação</label>
      <div className="relative">
        <select
          className={`w-full appearance-none px-2 py-2.5 pr-8 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow cursor-pointer ${error ? "border-red-300" : "border-gray-200"}`}
          {...registration}
        >
          {ACTION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
      </div>
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}
    </div>
  );
}