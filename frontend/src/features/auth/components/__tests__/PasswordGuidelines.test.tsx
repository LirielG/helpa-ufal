import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { PasswordGuidelines } from "../PasswordGuidelines";

describe("PasswordGuidelines", () => {
  it("lists all five password requirements", () => {
    render(<PasswordGuidelines password="" />);

    expect(screen.getByText("Pelo menos 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Uma letra maiúscula")).toBeInTheDocument();
    expect(screen.getByText("Uma letra minúscula")).toBeInTheDocument();
    expect(screen.getByText("Um número")).toBeInTheDocument();
    expect(
      screen.getByText("Um caractere especial (Ex: @, $, *, _)"),
    ).toBeInTheDocument();
  });

  it("marks every requirement as unmet for an empty password", () => {
    render(<PasswordGuidelines password="" />);

    expect(screen.getByText("Pelo menos 8 caracteres")).toHaveClass("text-gray-600");
  });

  it("marks a requirement as met once satisfied", () => {
    render(<PasswordGuidelines password="12345678" />);

    expect(screen.getByText("Pelo menos 8 caracteres")).toHaveClass("text-green-700");
    // Still missing uppercase/lowercase/symbol.
    expect(screen.getByText("Uma letra maiúscula")).toHaveClass("text-gray-600");
  });

  it("marks every requirement as met for a fully valid password", () => {
    render(<PasswordGuidelines password="Senha@123" />);

    for (const label of [
      "Pelo menos 8 caracteres",
      "Uma letra maiúscula",
      "Uma letra minúscula",
      "Um número",
      "Um caractere especial (Ex: @, $, *, _)",
    ]) {
      expect(screen.getByText(label)).toHaveClass("text-green-700");
    }
  });

  it("re-evaluates as the password prop changes", () => {
    const { rerender } = render(<PasswordGuidelines password="abc" />);
    expect(screen.getByText("Uma letra maiúscula")).toHaveClass("text-gray-600");

    rerender(<PasswordGuidelines password="Abc" />);
    expect(screen.getByText("Uma letra maiúscula")).toHaveClass("text-green-700");
  });
});
