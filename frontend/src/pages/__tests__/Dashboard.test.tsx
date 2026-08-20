import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test";
import { MOCK_ACTIONS } from "@/features/dashboard/constants";
import type { Action } from "@/features/dashboard/types";
import { Dashboard } from "../Dashboard";

/**
 * Titles of the action cards currently on screen. Cards are the only links
 * pointing at an action's detail page, which keeps the query clear of the
 * carousel headings and the footer links sharing the same page.
 */
function getVisibleActionTitles(): string[] {
  return screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/activity/"))
    .map((card) => within(card).getByRole("heading").textContent ?? "");
}

/** Expected titles, derived from the fixture so edits to it stay harmless. */
function titlesMatching(predicate: (action: Action) => boolean): string[] {
  return MOCK_ACTIONS.filter(predicate).map((action) => action.title);
}

describe("Dashboard", () => {
  it("lists every action when no filter is applied", () => {
    render(<Dashboard />);

    expect(getVisibleActionTitles()).toEqual(titlesMatching(() => true));
  });

  it("keeps only the actions with open spots when that filter is chosen", async () => {
    const { user } = render(<Dashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
      "available",
    );

    expect(getVisibleActionTitles()).toEqual(
      titlesMatching((action) => action.status === "available"),
    );
  });

  it("keeps only the actions without spots when that filter is chosen", async () => {
    const { user } = render(<Dashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
      "full",
    );

    expect(getVisibleActionTitles()).toEqual(
      titlesMatching((action) => action.status === "full"),
    );
  });

  // No mock action is a "palestra", so this filter can only come back empty.
  it("shows the empty state when no action matches the filter", async () => {
    const { user } = render(<Dashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por tipo de ação" }),
      "palestra",
    );

    expect(screen.getByText("Nenhuma ação encontrada")).toBeInTheDocument();
    expect(getVisibleActionTitles()).toEqual([]);
  });

  it("narrows the list further as filters are combined", async () => {
    const { user } = render(<Dashboard />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por disponibilidade" }),
      "full",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por tipo de ação" }),
      "oficina",
    );

    expect(getVisibleActionTitles()).toEqual(
      titlesMatching(
        (action) => action.status === "full" && action.type === "oficina",
      ),
    );
  });

  it("opens the action creation form from the header", async () => {
    const { user } = render(<Dashboard />);

    expect(screen.queryByText("Vamos criar uma ação?")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Criar uma ação" }));

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
  });
});
