import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { ActionGrid } from "../ActionGrid";
import type { Action } from "../../types";

describe("ActionGrid", () => {
  it("renders one card per action", () => {
    const actions = [
      { id: "1", title: "Primeira ação", type: "COURSE", status: "OPEN" },
      { id: "2", title: "Segunda ação", type: "EVENT", status: "COMPLETED" },
    ] as unknown as Action[];

    render(<ActionGrid actions={actions} />);

    expect(screen.getByText("Primeira ação")).toBeInTheDocument();
    expect(screen.getByText("Segunda ação")).toBeInTheDocument();
  });
});
