import { SearchField } from "../../../components/SearchField";
import { Select } from "../../../components/Select";
import { FILTER_OPTIONS } from "../constants";
import type { FilterOptions } from "../types";

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
}

const FIELDS: Array<{
  key: "area" | "actionType" | "availability";
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  { key: "area", label: "Área de atuação", options: FILTER_OPTIONS.areas },
  {
    key: "actionType",
    label: "Tipos de ação",
    options: FILTER_OPTIONS.actionTypes,
  },
  {
    key: "availability",
    label: "Disponibilidade",
    options: FILTER_OPTIONS.availability,
  },
];

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div
      className="w-full bg-white rounded-xl px-6 py-5 flex flex-col gap-5"
      style={{
        border: "1px solid #C4C6CF",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <SearchField
        value={filters.search ?? ""}
        onChange={(value) => onFilterChange("search", value)}
        label="Buscar ações pelo título"
        placeholder="Buscar ações pelo título..."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {FIELDS.map((field) => (
          <Select
            key={field.key}
            label={field.label}
            value={filters[field.key]}
            onChange={(event) => onFilterChange(field.key, event.target.value)}
            options={field.options}
          />
        ))}
      </div>
    </div>
  );
}
