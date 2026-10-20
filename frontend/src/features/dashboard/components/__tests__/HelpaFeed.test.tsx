import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import type { FilterOptions } from "../../types";
import { HelpaFeed } from "../HelpaFeed";

const ALL_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  status: "all",
  search: "",
};

function renderHelpaFeed({
  filters = {},
  hasError = false,
}: { filters?: Partial<FilterOptions>; hasError?: boolean } = {}) {
  const onRetry = vi.fn();
  const onResetFilters = vi.fn();
  const view = render(
    <HelpaFeed
      actions={[]}
      filters={{ ...ALL_FILTERS, ...filters }}
      onFilterChange={vi.fn()}
      onResetFilters={onResetFilters}
      page={1}
      totalPages={1}
      onPageChange={vi.fn()}
      isLoading={false}
      hasError={hasError}
      onRetry={onRetry}
    />,
  );

  return { ...view, onRetry, onResetFilters };
}

describe("HelpaFeed", () => {
  it("shows the shared error state with a retry action", async () => {
    const { user, onRetry } = renderHelpaFeed({ hasError: true });

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as ações",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers only the retry action in the error state", () => {
    renderHelpaFeed({ hasError: true, filters: { area: "Saúde" } });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Explorar ações no Helpa" }),
    ).not.toBeInTheDocument();
  });

  it("offers to clear the filters when a select filter matches nothing", async () => {
    const { user, onResetFilters } = renderHelpaFeed({
      filters: { actionType: "LECTURE" },
    });

    expect(
      screen.getByRole("heading", { name: "Nenhuma ação encontrada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma ação corresponde a esses filtros."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(onResetFilters).toHaveBeenCalledOnce();
  });

  it("names the term when the search matches nothing", () => {
    renderHelpaFeed({ filters: { search: "  xilofone " } });

    expect(
      screen.getByText('Nenhuma ação encontrada para "xilofone".'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Limpar filtros" }),
    ).toBeInTheDocument();
  });

  it("offers no filter action when the feed is empty without filters", () => {
    renderHelpaFeed();

    expect(
      screen.getByRole("heading", { name: "Nenhuma ação cadastrada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ainda não há ações publicadas no Helpa."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("treats a blank search as no filter", () => {
    renderHelpaFeed({ filters: { search: "   " } });

    expect(
      screen.getByRole("heading", { name: "Nenhuma ação cadastrada" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
