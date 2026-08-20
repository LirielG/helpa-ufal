import { describe, expect, it } from "vitest";
import { makeAction, render, screen, within } from "@/test";
import { ActionGrid } from "../ActionGrid";

/** Titles of the rendered cards, in the order they appear in the document. */
function getRenderedTitles(): string[] {
  return screen
    .getAllByRole("link")
    .map((card) => within(card).getByRole("heading").textContent ?? "");
}

describe("ActionGrid", () => {
  it("renders one card per action, keeping the given order", () => {
    const actions = [
      makeAction({ title: "Primeira ação" }),
      makeAction({ title: "Segunda ação" }),
      makeAction({ title: "Terceira ação" }),
    ];

    render(<ActionGrid actions={actions} />);

    expect(getRenderedTitles()).toEqual([
      "Primeira ação",
      "Segunda ação",
      "Terceira ação",
    ]);
  });

  it("does not show the empty state while there are actions", () => {
    render(<ActionGrid actions={[makeAction()]} />);

    expect(screen.queryByText("Nenhuma ação encontrada")).toBeNull();
  });

  it("invites the user to adjust the filters when there is no action", () => {
    render(<ActionGrid actions={[]} />);

    expect(screen.getByText("Nenhuma ação encontrada")).toBeInTheDocument();
    expect(screen.getByText("Tente ajustar os filtros")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
