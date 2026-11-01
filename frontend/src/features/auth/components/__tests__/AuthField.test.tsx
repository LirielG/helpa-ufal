import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { AuthField } from "../AuthField";

type HarnessProps = {
  error?: string;
  labelIcon?: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
};

/**
 * AuthField expects a real react-hook-form `registration` object, so the
 * harness mounts a minimal form around it instead of hand-rolling a fake
 * UseFormRegisterReturn.
 */
function Harness({ error, labelIcon, type }: HarnessProps) {
  const { register } = useForm<{ field: string }>();
  return (
    <AuthField
      label="Nome completo"
      placeholder="Digite seu nome completo"
      error={error}
      labelIcon={labelIcon}
      type={type}
      registration={register("field")}
    />
  );
}

describe("AuthField", () => {
  it("renders the field with its label and placeholder", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Nome completo")).toHaveAttribute(
      "placeholder",
      "Digite seu nome completo",
    );
  });

  it("lets the user type into the field", async () => {
    const { user } = render(<Harness />);

    const input = screen.getByLabelText("Nome completo");
    await user.type(input, "Jéssica Silva");

    expect(input).toHaveValue("Jéssica Silva");
  });

  it("does not show an error message by default", () => {
    render(<Harness />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("shows the validation error message when provided", () => {
    render(<Harness error="Nome é obrigatório" />);
    expect(screen.getByText("Nome é obrigatório")).toBeInTheDocument();
  });

  it("defaults to a text input but forwards a custom type", () => {
    const { rerender } = render(<Harness />);
    const input = screen.getByLabelText("Nome completo");
    expect(input).toHaveAttribute("type", "text");

    rerender(<Harness type="email" />);
    expect(input).toHaveAttribute("type", "email");
  });

  it("renders an optional labelIcon next to the label", () => {
    render(<Harness labelIcon={<span data-testid="label-icon">?</span>} />);
    expect(screen.getByTestId("label-icon")).toBeInTheDocument();
  });
});
