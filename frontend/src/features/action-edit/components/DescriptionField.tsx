import type { UseFormRegisterReturn } from "react-hook-form";

interface DescriptionFieldProps {
  registration: UseFormRegisterReturn;
  error?: string;
}

export function DescriptionField({ registration, error }: DescriptionFieldProps) {
  return (
    <div className="flex flex-col h-full space-y-1">
      <label className="text-sm font-semibold text-gray-700">Descrição</label>
      <textarea
        placeholder="Descreva os detalhes da ação..."
        className={`w-full flex-1 min-h-[420px] px-4 py-3 text-sm text-gray-700 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
          error ? "border-red-300" : "border-gray-200"
        }`}
        {...registration}
      />
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}
    </div>
  );
}