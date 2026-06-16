import type { UseFormRegisterReturn } from "react-hook-form";

interface TitleFieldProps {
  registration: UseFormRegisterReturn;
  error?: string;
}

export function TitleField({ registration, error }: TitleFieldProps) {
  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="Título"
        className={`w-full px-5 py-4 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
          error ? "border-red-300" : "border-gray-200"
        }`}
        {...registration}
      />
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}
    </div>
  );
}