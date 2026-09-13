import { Search } from "lucide-react";
import { Alert } from "../../../components/Alert";
import { Select } from "../../../components/Select";
import { ALL_OPTION, SIGAA_ORDER_OPTIONS } from "../constants";
import type { SigaaFeedFilters, SigaaFilterOptions } from "../types";

interface SigaaFilterBarProps {
  filters: SigaaFeedFilters;
  onFilterChange: (key: keyof SigaaFeedFilters, value: string) => void;
  options: SigaaFilterOptions;
  isLoadingOptions: boolean;
  hasError?: boolean;
}

const NOTICE = {
  info: "ATENÇÃO! As ações do SIGAA não são inscritas pela plataforma.",
  warning:
    "Aviso de integração: as inscrições das ações do SIGAA são feitas apenas no portal do SIGAA, e os dados desta aba não puderam ser carregados agora.",
} as const;

function toOptions(
  values: string[],
  allLabel: string,
): Array<{ value: string; label: string }> {
  return [
    { value: ALL_OPTION, label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ];
}

export function SigaaFilterBar({
  filters,
  onFilterChange,
  options,
  isLoadingOptions,
  hasError = false,
}: SigaaFilterBarProps) {
  const typeDisabled = isLoadingOptions || options.types.length === 0;
  const departmentDisabled =
    isLoadingOptions || options.departments.length === 0;

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-5">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onFilterChange("search", event.target.value)}
          placeholder="Pesquisar ações do SIGAA..."
          aria-label="Pesquisar ações do SIGAA"
          className="w-full rounded-lg border border-gray-300 py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select
          label="Tipo"
          value={filters.type}
          disabled={typeDisabled}
          onChange={(event) => onFilterChange("type", event.target.value)}
          options={
            isLoadingOptions
              ? [{ value: ALL_OPTION, label: "Carregando..." }]
              : toOptions(options.types, "Todos os tipos")
          }
        />

        <Select
          label="Departamento"
          value={filters.department}
          disabled={departmentDisabled}
          onChange={(event) => onFilterChange("department", event.target.value)}
          options={
            isLoadingOptions
              ? [{ value: ALL_OPTION, label: "Carregando..." }]
              : toOptions(options.departments, "Todos os departamentos")
          }
        />

        <Select
          label="Ordem"
          value={filters.order}
          onChange={(event) => onFilterChange("order", event.target.value)}
          options={SIGAA_ORDER_OPTIONS.map(({ value, label }) => ({
            value,
            label,
          }))}
        />
      </div>

      <Alert
        type={hasError ? "warning" : "info"}
        message={hasError ? NOTICE.warning : NOTICE.info}
      />
    </div>
  );
}
