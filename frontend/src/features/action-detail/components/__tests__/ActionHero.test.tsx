import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test";
import { ActionHero } from "../ActionHero";

describe("ActionHero", () => {
  it("renders bounded hero height with cover, category badge, title and back button", async () => {
    const onBack = vi.fn();
    const { container, user } = render(
      <ActionHero
        actionId="action-1"
        type="COURSE"
        category="Tecnologia"
        title="Oficina de Programação"
        onBack={onBack}
      />,
    );

    expect(container.firstElementChild).toHaveClass(
      "min-h-[clamp(16rem,35vh,24rem)]",
    );
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Tecnologia")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Oficina de Programação" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
