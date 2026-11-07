import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { ActionCard } from "../ActionCard";
import { ActionHero } from "@/features/action-detail/components/ActionHero";
import type {
  ActivityListItem,
  ActivityStatus,
} from "@/services/contracts/activity";

function makeAction(
  overrides: Partial<ActivityListItem> = {},
): ActivityListItem {
  return {
    id: "action-42",
    title: "Oficina de Robótica",
    campus: "SANTANA_IPANEMA",
    startDate: "2026-05-09T12:00:00Z",
    endDate: "2026-05-10T12:00:00Z",
    availableSlots: 25,
    slots: 30,
    status: "OPEN",
    type: "COURSE",
    ...overrides,
  } as ActivityListItem;
}

describe("ActionCard", () => {
  it("shows the title, location, date and number of spots", () => {
    render(<ActionCard action={makeAction()} />);

    expect(
      screen.getByRole("heading", { name: "Oficina de Robótica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("UFAL - Campus Santana do Ipanema"),
    ).toBeInTheDocument();
    expect(screen.getByText(/25 vagas disponíveis/i)).toBeInTheDocument();
    expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
    expect(screen.getByText("Curso ou minicurso")).toBeInTheDocument();
  });

  it("falls back to 'Não informado' when the action has no campus", () => {
    render(<ActionCard action={makeAction({ campus: undefined })} />);

    expect(screen.getByText("Não informado")).toBeInTheDocument();
  });

  it.each([
    ["EXTENSION", "Ação de extensão"],
    ["COURSE", "Curso ou minicurso"],
    ["EVENT", "Evento"],
    ["LECTURE", "Palestra"],
    ["OTHER", "Outro"],
  ] as const)(
    "labels the %s type as the filter and the action form do",
    (type, label) => {
      render(<ActionCard action={makeAction({ type })} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it("links to the detail page of its own action", () => {
    render(<ActionCard action={makeAction()} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/activity/action-42",
    );
  });

  it("formats 1 spot in singular", () => {
    render(<ActionCard action={makeAction({ availableSlots: 1 })} />);

    expect(screen.getByText("1 vaga disponível")).toBeInTheDocument();
  });

  it("shows 'Vagas esgotadas' when availableSlots is 0 and does not display '0'", () => {
    render(<ActionCard action={makeAction({ availableSlots: 0 })} />);

    expect(screen.getByText("Vagas esgotadas")).toBeInTheDocument();
    expect(screen.queryByText(/0 vaga/i)).not.toBeInTheDocument();
  });

  it("handles 3-digit spot count correctly", () => {
    render(<ActionCard action={makeAction({ availableSlots: 120 })} />);

    expect(screen.getByText("120 vagas disponíveis")).toBeInTheDocument();
  });

  it.each([
    ["IN_PROGRESS", "Em Andamento"],
    ["COMPLETED", "Finalizada"],
    ["CANCELLED", "Cancelada"],
  ] as const)(
    "hides the slots badge for %s actions that still have spots",
    (status, statusLabel) => {
      render(
        <ActionCard action={makeAction({ status, availableSlots: 10 })} />,
      );

      expect(screen.getByText(statusLabel)).toBeInTheDocument();
      expect(screen.queryByText(/vaga/i)).not.toBeInTheDocument();
    },
  );

  it.each([
    ["OPEN", "Inscrições Abertas"],
    ["IN_PROGRESS", "Em Andamento"],
    ["COMPLETED", "Finalizada"],
    ["CANCELLED", "Cancelada"],
  ] as const)(
    "renders the correct label for status %s",
    (status, expectedLabel) => {
      render(
        <ActionCard
          action={makeAction({ status: status as ActivityStatus })}
        />,
      );

      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    },
  );

  it("falls back to status string for unknown status", () => {
    render(
      <ActionCard
        action={makeAction({ status: "UNKNOWN_STATUS" as ActivityStatus })}
      />,
    );

    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
  });

  it("shows a cover named after the action, without any remote image", () => {
    render(<ActionCard action={makeAction()} />);

    const [cover, ...others] = screen.getAllByRole("img");
    expect(cover).toHaveAccessibleName("Oficina de Robótica");
    expect(cover.tagName).not.toBe("IMG");
    expect(others).toHaveLength(0);
  });

  it("uses the same cover as the detail banner of the same action", () => {
    const action = makeAction();
    const { unmount } = render(<ActionCard action={action} />);
    const cardVariant = screen
      .getByRole("img", { name: action.title })
      .getAttribute("data-cover-variant");
    unmount();

    render(
      <ActionHero
        actionId={action.id}
        type={action.type}
        category="Robótica"
        title={action.title}
        onBack={() => {}}
      />,
    );

    // The hero cover is decorative (the <h1> already carries the title), so
    // it is only reachable with hidden: true.
    expect(
      screen
        .getByRole("img", { hidden: true })
        .getAttribute("data-cover-variant"),
    ).toBe(cardVariant);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
