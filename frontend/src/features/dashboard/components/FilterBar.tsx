import { useEffect, useState } from "react";
import { SearchField } from "../../../components/SearchField";
import { Select } from "../../../components/Select";
import { FILTER_OPTIONS } from "../constants";
import { fetchAreaSuggestions } from "../services";
import type { FilterOptions } from "../types";

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
}

const ALL_AREAS = { value: "all", label: "Todas as áreas" };

const FIELDS: Array<{
  key: "actionType" | "status";
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    key: "actionType",
    label: "Tipos de ação",
    options: FILTER_OPTIONS.actionTypes,
  },
  {
    key: "status",
    label: "Status",
    options: FILTER_OPTIONS.status,
  },
];

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const [areas, setAreas] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchAreaSuggestions().then((suggestions) => {
      if (isMounted) setAreas(suggestions);
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
        {/* `area` is free text in the API, so each option's value is the
            area itself. Loading, an empty list and a failed request all
            leave only "Todas as áreas", which never filters the feed. */}
        <Select
          label="Área de atuação"
          value={filters.area}
          disabled={areas.length === 0}
          onChange={(event) => onFilterChange("area", event.target.value)}
          options={[
            ALL_AREAS,
            ...areas.map((area) => ({ value: area, label: area })),
          ]}
        />
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
