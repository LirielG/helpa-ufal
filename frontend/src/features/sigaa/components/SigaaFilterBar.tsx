import { Alert } from "../../../components/Alert";
import { SearchField } from "../../../components/SearchField";
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
      <SearchField
        value={filters.search}
        onChange={(value) => onFilterChange("search", value)}
        label="Pesquisar ações do SIGAA"
        placeholder="Pesquisar ações do SIGAA..."
      />

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
