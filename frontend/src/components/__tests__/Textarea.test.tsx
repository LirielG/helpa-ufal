import { describe, expect, it } from "vitest";
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
});
