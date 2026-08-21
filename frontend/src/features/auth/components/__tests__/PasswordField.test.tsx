import { useState } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { PasswordField } from "../PasswordField";

type HarnessProps = {
  error?: string;
  onTogglePassword?: () => void;
};

/** Mounts PasswordField with a real react-hook-form registration. */
function Harness({ error, onTogglePassword }: HarnessProps) {
  const { register } = useForm<{ password: string }>();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <PasswordField
      label="Senha"
      error={error}
      registration={register("password")}
      showPassword={showPassword}
      onTogglePassword={onTogglePassword ?? (() => setShowPassword((v) => !v))}
    />
  );
}

describe("PasswordField", () => {
  it("masks the value by default", () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText("Digite sua senha")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("uses the default placeholder unless one is provided", () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText("Digite sua senha")).toBeInTheDocument();
  });

  it("reveals the password when the toggle button is clicked", async () => {
    const { user } = render(<Harness />);

    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    const input = screen.getByPlaceholderText("Digite sua senha");
    expect(input).toHaveAttribute("type", "password");

    await user.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();
  });

  it("calls the onTogglePassword callback instead of managing state itself", async () => {
    const onTogglePassword = vi.fn();
    const { user } = render(<Harness onTogglePassword={onTogglePassword} />);

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(onTogglePassword).toHaveBeenCalledTimes(1);
    // The harness's own state didn't move because the callback was
    // overridden, proving visibility is fully controlled by the prop.
    expect(screen.getByPlaceholderText("Digite sua senha")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("shows the validation error message when provided", () => {
    render(<Harness error="Senha deve ter no mínimo 8 caracteres" />);
    expect(
      screen.getByText("Senha deve ter no mínimo 8 caracteres"),
    ).toBeInTheDocument();
  });

  it("lets the user type a password", async () => {
    const { user } = render(<Harness />);

    const input = screen.getByPlaceholderText("Digite sua senha");
    await user.type(input, "Senha@123");

    expect(input).toHaveValue("Senha@123");
  });
});
