import { describe, expect, it } from "vitest";
import { makeAction, render, screen } from "@/test";
import type { ActionStatus } from "../../types";
import { ActionCard } from "../ActionCard";

const STATUS_LABELS: Array<[ActionStatus, string]> = [
  ["available", "Vagas Disponíveis"],
  ["full", "Vagas Esgotadas"],
  ["upcoming", "Em Breve"],
];

describe("ActionCard", () => {
  it("shows the title, description, location, date and number of spots", () => {
    const action = makeAction({
      title: "Oficina de Robótica",
      description: "Montagem de kits com estudantes do ensino médio.",
      location: "UFAL, Arapiraca - AL",
      date: "09/05/2026",
      spots: 25,
    });

    render(<ActionCard action={action} />);

    expect(
      screen.getByRole("heading", { name: "Oficina de Robótica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Montagem de kits com estudantes do ensino médio."),
    ).toBeInTheDocument();
    expect(screen.getByText("UFAL, Arapiraca - AL")).toBeInTheDocument();
    expect(screen.getByText("09/05/2026")).toBeInTheDocument();
    expect(screen.getByText("25 vagas")).toBeInTheDocument();
  });

  it("links to the detail page of its own action", () => {
    const action = makeAction({ id: "action-42" });

    render(<ActionCard action={action} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/activity/action-42",
    );
  });

  it("uses the title as the alt text of the cover image", () => {
    const action = makeAction({
      title: "Aulas de Reforço",
      image: "https://example.test/reforco.png",
    });

    render(<ActionCard action={action} />);

    expect(
      screen.getByRole("img", { name: "Aulas de Reforço" }),
    ).toHaveAttribute("src", "https://example.test/reforco.png");
  });

  it.each(STATUS_LABELS)(
    "labels an action with status %s as %s",
    (status, label) => {
      render(<ActionCard action={makeAction({ status })} />);

      expect(screen.getByText(label)).toBeInTheDocument();

      const otherLabels = STATUS_LABELS.filter(
        ([, other]) => other !== label,
      ).map(([, other]) => other);
      for (const otherLabel of otherLabels) {
        expect(screen.queryByText(otherLabel)).toBeNull();
      }
    },
  );

  // The type is rendered as the raw slug and only capitalized by CSS, so the
  // text node itself stays lowercase.
  it("shows the action type", () => {
    render(<ActionCard action={makeAction({ type: "minicurso" })} />);

    expect(screen.getByText("minicurso")).toBeInTheDocument();
  });
});
