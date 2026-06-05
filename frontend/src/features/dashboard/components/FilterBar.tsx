import { ChevronDown } from "lucide-react";
import { FILTER_OPTIONS } from "../constants";
import type { FilterOptions } from "../types";

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <div className="bg-[#1B75BB] rounded-xl py-2 px-4">
      <div className="flex flex-wrap gap-4">
        
        <div className="relative min-w-[200px]">
          <select
            value={filters.area}
            onChange={(e) => onFilterChange("area", e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-1.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {FILTER_OPTIONS.areas.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative min-w-[200px]">
          <select
            value={filters.actionType}
            onChange={(e) => onFilterChange("actionType", e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-1.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {FILTER_OPTIONS.actionTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative min-w-[200px]">
          <select
            value={filters.availability}
            onChange={(e) => onFilterChange("availability", e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-1.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {FILTER_OPTIONS.availability.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none" />
        </div>
        
      </div>
    </div>
  );
}