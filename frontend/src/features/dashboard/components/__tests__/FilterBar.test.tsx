import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { FILTER_OPTIONS } from "../../constants";
import type { FilterOptions } from "../../types";
import { FilterBar } from "../FilterBar";

const ALL_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  availability: "all",
};

function renderFilterBar(filters: Partial<FilterOptions> = {}) {
  const onFilterChange = vi.fn();
  const view = render(
    <FilterBar
      filters={{ ...ALL_FILTERS, ...filters }}
      onFilterChange={onFilterChange}
    />,
  );

  return { ...view, onFilterChange };
}

describe("FilterBar", () => {
  it("starts with every filter showing its 'all' option", () => {
    renderFilterBar();

    expect(
      screen.getByRole("combobox", { name: "Filtrar por área" }),
    ).toHaveValue("all");
    expect(
      screen.getByRole("combobox", { name: "Filtrar por tipo de ação" }),
    ).toHaveValue("all");
    expect(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
    ).toHaveValue("all");
  });

  it("shows the filters it is given as the selected options", () => {
    renderFilterBar({ actionType: "palestra", availability: "full" });

    expect(
      screen.getByRole("combobox", { name: "Filtrar por tipo de ação" }),
    ).toHaveValue("palestra");
    expect(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
    ).toHaveValue("full");
  });

  it("reports the chosen availability to the parent", async () => {
    const { user, onFilterChange } = renderFilterBar();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
      "full",
    );

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith(
      "availability",
      "full",
    );
  });

  it("reports the chosen action type to the parent", async () => {
    const { user, onFilterChange } = renderFilterBar();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por tipo de ação" }),
      "palestra",
    );

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith(
      "actionType",
      "palestra",
    );
  });

  it("offers every configured option in each filter", () => {
    renderFilterBar();

    const optionLabels = (name: string) =>
      Array.from(
        screen.getByRole("combobox", { name }).querySelectorAll("option"),
        (option) => option.textContent,
      );

    expect(optionLabels("Filtrar por área")).toEqual(
      FILTER_OPTIONS.areas.map((option) => option.label),
    );
    expect(optionLabels("Filtrar por tipo de ação")).toEqual(
      FILTER_OPTIONS.actionTypes.map((option) => option.label),
    );
    expect(optionLabels("Filtrar por disponibilidade")).toEqual(
      FILTER_OPTIONS.availability.map((option) => option.label),
    );
  });
});
