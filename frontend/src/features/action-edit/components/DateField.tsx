import type { UseFormRegisterReturn } from "react-hook-form";

interface DateFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
}

export function DateField({ label, registration, error }: DateFieldProps) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="block text-sm font-semibold text-gray-700 truncate">{label}</label>
      <input
        type="date"
        className={`w-full px-2 py-2.5 text-xs text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${error ? "border-red-300" : "border-gray-200"}`}
        {...registration}
      />
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
    </div>
  );
}