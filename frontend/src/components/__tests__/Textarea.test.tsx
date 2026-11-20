import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test";
import { Textarea } from "../Textarea";

describe("Textarea", () => {
  it("is named after its label", () => {
    render(<Textarea label="Descrição" defaultValue="Oficina" />);

    expect(screen.getByRole("textbox", { name: "Descrição" })).toHaveValue(
      "Oficina",
    );
  });

  it("keeps an id passed by the caller", () => {
    render(<Textarea label="Descrição" id="action-description" />);

    expect(screen.getByLabelText("Descrição")).toHaveAttribute(
      "id",
      "action-description",
    );
  });

  it("does not render a character counter when maxLength is omitted", () => {
    render(<Textarea label="Descrição" defaultValue="Texto inicial" />);

    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("shows 0/500 when empty and links counter via aria-describedby", () => {
    render(<Textarea label="Descrição" id="desc" maxLength={500} />);

    const textarea = screen.getByLabelText("Descrição");
    const counter = screen.getByText("0/500");

    expect(counter).toHaveClass("text-gray-500");
    expect(textarea).toHaveAttribute("aria-describedby", "desc-counter");
    expect(counter).toHaveAttribute("id", "desc-counter");
  });

  it("switches counter color from gray to amber at 90% and red at 100%", () => {
    const { rerender } = render(
      <Textarea
        label="Descrição"
        maxLength={500}
        value={"a".repeat(449)}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("449/500")).toHaveClass("text-gray-500");

    rerender(
      <Textarea
        label="Descrição"
        maxLength={500}
        value={"a".repeat(450)}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("450/500")).toHaveClass("text-amber-600");

    rerender(
      <Textarea
        label="Descrição"
        maxLength={500}
        value={"a".repeat(500)}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("500/500")).toHaveClass("text-red-500");
  });

  it("blocks typing past maxLength and announces only when reaching the limit", async () => {
    const user = userEvent.setup();
    render(<Textarea label="Descrição" maxLength={5} />);

    const textarea = screen.getByLabelText("Descrição");

    await user.type(textarea, "abcd");
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(
      screen.queryByText("Limite de 5 caracteres atingido."),
    ).not.toBeInTheDocument();

    await user.type(textarea, "ef");
    expect(textarea).toHaveValue("abcde");
    expect(screen.getByText("5/5")).toHaveClass("text-red-500");
    expect(
      screen.getByText("Limite de 5 caracteres atingido."),
    ).toHaveAttribute("aria-live", "polite");
  });
});