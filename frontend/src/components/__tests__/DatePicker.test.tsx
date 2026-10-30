import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "../DatePicker";
import { displayToISO, isoToDisplay } from "../../utils/dateField";

function Harness({ initial = "", min }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker
        aria-label="Data"
        value={value}
        onChange={setValue}
        min={min}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("DatePicker", () => {
  it("shows the stored aaaa-mm-dd as dd/mm/aaaa", () => {
    render(<Harness initial="2026-03-10" />);
    expect(screen.getByLabelText("Data")).toHaveValue("10/03/2026");
  });

  it("masks typing and stores aaaa-mm-dd", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Data"), "10032026");

    expect(screen.getByLabelText("Data")).toHaveValue("10/03/2026");
    expect(screen.getByTestId("value")).toHaveTextContent("2026-03-10");
  });

  it("shows its own message for a date that does not exist", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Data"), "31022026");

    expect(
      screen.getByText("Informe uma data válida (dd/mm/aaaa)."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("opens a pt-BR calendar with the days before the minimum disabled", async () => {
    const user = userEvent.setup();
    render(<Harness min="2026-03-10" />);

    await user.click(screen.getByRole("button", { name: /Abrir calendário/ }));

    expect(screen.getByText(/março 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /(^|\s)9 de março/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /(^|\s)10 de março/ })).toBeEnabled();
  });

  it("picks a day from the calendar", async () => {
    const user = userEvent.setup();
    render(<Harness min="2026-03-10" />);

    await user.click(screen.getByRole("button", { name: /Abrir calendário/ }));
    await user.click(screen.getByRole("button", { name: /(^|\s)12 de março/ }));

    expect(screen.getByLabelText("Data")).toHaveValue("12/03/2026");
    expect(screen.getByTestId("value")).toHaveTextContent("2026-03-12");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the calendar with Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /Abrir calendário/ }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the calendar in a body portal outside scroll containers and keeps it open on month navigation", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="scroll-box" className="overflow-y-auto">
        <Harness min="2026-03-10" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /Abrir calendário/ }));

    const dialog = screen.getByRole("dialog", { name: "Calendário" });
    expect(dialog).toHaveClass("fixed");
    expect(screen.getByTestId("scroll-box")).not.toContainElement(dialog);

    await user.click(
      screen.getByRole("button", { name: /Ir para o próximo mês/i }),
    );
    expect(screen.getByText(/abril 2026/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("converts between the two formats", () => {
    expect(isoToDisplay("2026-03-10")).toBe("10/03/2026");
    expect(displayToISO("10/03/2026")).toBe("2026-03-10");
    expect(displayToISO("31/02/2026")).toBeUndefined();
  });
});
