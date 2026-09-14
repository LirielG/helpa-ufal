import { ChevronDown } from "lucide-react";
import { FILTER_OPTIONS } from "../constants";
import type { FilterOptions } from "../types";

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div
      className="w-full bg-white rounded-xl px-6 py-5"
      style={{ border: "1px solid #C4C6CF", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
    >
      <div className="flex flex-col md:flex-row gap-5">

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs text-gray-500 font-normal">
            Área de atuação
          </label>
          <div className="relative">
            <select
              aria-label="Filtrar por área"
              value={filters.area}
              onChange={(e) => onFilterChange("area", e.target.value)}
              className="w-full appearance-none rounded-lg px-4 py-3 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ backgroundColor: "rgba(196,198,207,0.2)", border: "1px solid #C4C6CF" }}
            >
              {FILTER_OPTIONS.areas.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs text-gray-500 font-normal">
            Tipos de ação
          </label>
          <div className="relative">
            <select
              aria-label="Filtrar por tipo de ação"
              value={filters.actionType}
              onChange={(e) => onFilterChange("actionType", e.target.value)}
              className="w-full appearance-none rounded-lg px-4 py-3 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ backgroundColor: "rgba(196,198,207,0.2)", border: "1px solid #C4C6CF" }}
            >
              {FILTER_OPTIONS.actionTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs text-gray-500 font-normal">
            Disponibilidade
          </label>
          <div className="relative">
            <select
              aria-label="Filtrar por disponibilidade"
              value={filters.availability}
              onChange={(e) => onFilterChange("availability", e.target.value)}
              className="w-full appearance-none rounded-lg px-4 py-3 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ backgroundColor: "rgba(196,198,207,0.2)", border: "1px solid #C4C6CF" }}
            >
              {FILTER_OPTIONS.availability.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none" />
          </div>
        </div>

      </div>
    </div>
  );
}
