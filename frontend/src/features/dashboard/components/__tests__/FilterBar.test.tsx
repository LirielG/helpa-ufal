import { describe, expect, it, vi } from "vitest";
import {
  API,
  http,
  HttpResponse,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import { FILTER_OPTIONS } from "../../constants";
import type { FilterOptions } from "../../types";
import { FilterBar } from "../FilterBar";

const ALL_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  status: "all",
  search: "",
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
      screen.getByRole("combobox", { name: "Área de atuação" }),
    ).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Tipos de ação" })).toHaveValue(
      "all",
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
  });

  it("shows the filters it is given as the selected options", () => {
    renderFilterBar({ actionType: "LECTURE", status: "OPEN" });

    expect(screen.getByRole("combobox", { name: "Tipos de ação" })).toHaveValue(
      "LECTURE",
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(
      "OPEN",
    );
  });

  it("reports the chosen status to the parent", async () => {
    const { user, onFilterChange } = renderFilterBar();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "OPEN",
    );

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("status", "OPEN");
  });

  it("reports the chosen action type to the parent", async () => {
    const { user, onFilterChange } = renderFilterBar();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Tipos de ação" }),
      "LECTURE",
    );

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith(
      "actionType",
      "LECTURE",
    );
  });

  it("shows the search term it is given in the search field", () => {
    renderFilterBar({ search: "robótica" });

    expect(
      screen.getByRole("searchbox", { name: "Buscar ações pelo título" }),
    ).toHaveValue("robótica");
  });

  it("reports each typed character of the search term to the parent", async () => {
    const { user, onFilterChange } = renderFilterBar();

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar ações pelo título" }),
      "ab",
    );

    // The field is controlled by an unchanging prop here, so every keystroke
    // reports from the same empty value; the parent is what accumulates it.
    expect(onFilterChange).toHaveBeenNthCalledWith(1, "search", "a");
    expect(onFilterChange).toHaveBeenNthCalledWith(2, "search", "b");
  });

  describe("area filter", () => {
    const areaSelect = () =>
      screen.getByRole("combobox", { name: "Área de atuação" });

    const areaLabels = () =>
      Array.from(
        areaSelect().querySelectorAll("option"),
        (option) => option.textContent,
      );

    it("offers the areas the API returns, in the order it returns them", async () => {
      server.use(
        http.get(`${API}/activities/filters`, () =>
          HttpResponse.json({ areas: ["Saúde", "Educação", "Robótica"] }),
        ),
      );
      renderFilterBar();

      await waitFor(() => expect(areaSelect()).toBeEnabled());
      expect(areaLabels()).toEqual([
        "Todas as áreas",
        "Saúde",
        "Educação",
        "Robótica",
      ]);
    });

    it("reports the text of the chosen area to the parent", async () => {
      const { user, onFilterChange } = renderFilterBar();

      await waitFor(() => expect(areaSelect()).toBeEnabled());
      await user.selectOptions(areaSelect(), "Saúde");

      expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("area", "Saúde");
    });

    it("disables the area filter when the API has no areas", async () => {
      let served = false;
      server.use(
        http.get(`${API}/activities/filters`, () => {
          served = true;
          return HttpResponse.json({ areas: [] });
        }),
      );
      renderFilterBar();

      await waitFor(() => expect(served).toBe(true));
      expect(areaSelect()).toBeDisabled();
      expect(areaLabels()).toEqual(["Todas as áreas"]);
    });

    it("disables the area filter when the areas fail to load", async () => {
      let served = false;
      server.use(
        http.get(`${API}/activities/filters`, () => {
          served = true;
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderFilterBar();

      await waitFor(() => expect(served).toBe(true));
      expect(areaSelect()).toBeDisabled();
      expect(areaLabels()).toEqual(["Todas as áreas"]);
    });
  });

  it("offers every configured option in each filter", () => {
    renderFilterBar();

    const optionLabels = (name: string) =>
      Array.from(
        screen.getByRole("combobox", { name }).querySelectorAll("option"),
        (option) => option.textContent,
      );

    expect(optionLabels("Tipos de ação")).toEqual(
      FILTER_OPTIONS.actionTypes.map((option) => option.label),
    );
    expect(optionLabels("Status")).toEqual(
      FILTER_OPTIONS.status.map((option) => option.label),
    );
  });
});
