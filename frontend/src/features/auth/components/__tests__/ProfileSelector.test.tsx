import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { ProfileSelector } from "../ProfileSelector";

describe("ProfileSelector", () => {
  it("renders a card for every profile option", () => {
    render(<ProfileSelector selectedType={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: /docente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /estudante/i })).toBeInTheDocument();
  });

  it("shows the call-to-action label when nothing is selected yet", () => {
    render(<ProfileSelector selectedType={null} onSelect={vi.fn()} />);

    const buttons = screen.getAllByText("Criar →");
    expect(buttons).toHaveLength(2);
  });

  it("marks the currently selected profile as 'Selecionado'", () => {
    render(<ProfileSelector selectedType="teacher" onSelect={vi.fn()} />);

    const teacherCard = screen.getByRole("button", { name: /docente/i });
    expect(teacherCard).toHaveTextContent("Selecionado");

    const studentCard = screen.getByRole("button", { name: /estudante/i });
    expect(studentCard).toHaveTextContent("Criar →");
  });

  it("calls onSelect with the profile type that was clicked", async () => {
    const onSelect = vi.fn();
    const { user } = render(
      <ProfileSelector selectedType={null} onSelect={onSelect} />,
    );

    await user.click(screen.getByRole("button", { name: /estudante/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("student");

    await user.click(screen.getByRole("button", { name: /docente/i }));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("teacher");
  });
});
