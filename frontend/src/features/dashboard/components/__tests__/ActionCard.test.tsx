import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { ActionCard } from "../ActionCard";
import type { Action } from "../../types";

describe("ActionCard", () => {
  it("shows the title, location, date and number of spots", () => {
    const action = {
      id: "action-42",
      title: "Oficina de Robótica",
      campus: "UFAL, Arapiraca - AL",
      startDate: "2026-05-09T12:00:00Z",
      availableSlots: 25,
      status: "OPEN",
      type: "COURSE"
    } as unknown as Action;

    render(<ActionCard action={action} />);

    expect(screen.getByRole("heading", { name: "Oficina de Robótica" })).toBeInTheDocument();
    expect(screen.getByText("UFAL, Arapiraca - AL")).toBeInTheDocument();
    expect(screen.getByText(/25 vagas disponíveis/i)).toBeInTheDocument();
    expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
    expect(screen.getByText("Curso/Oficina")).toBeInTheDocument();
  });

  it("links to the detail page of its own action", () => {
    const action = { id: "action-42", type: "COURSE", status: "OPEN" } as unknown as Action;
    
    render(<ActionCard action={action} />);
    
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/activity/action-42"
    );
  });
});
