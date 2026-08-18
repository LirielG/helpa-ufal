import type { UseFormRegisterReturn } from "react-hook-form";

interface SpotsFieldProps {
  registration: UseFormRegisterReturn;
  error?: string;
}

export function SpotsField({ registration, error }: SpotsFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-700">Qtde. de Vagas</label>
      <input
        type="number"
        min={1}
        placeholder="0"
        className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${error ? "border-red-300" : "border-gray-200"}`}
        {...registration}
      />
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}
    </div>
  );
}