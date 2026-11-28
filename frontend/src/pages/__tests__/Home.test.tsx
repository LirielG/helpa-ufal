import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { Home } from "../Home";
import { HELPA_JOURNEY_TITLE } from "@/features/home/constants/howItWorks";

describe("Home", () => {
  it("renders the header, the about section, and the footer", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /navegação da página inicial/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /como nasceu o helpa/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("is keyboard navigable and the first Tab reaches a visible target", async () => {
    const { user } = render(<Home />);

    await user.tab();

    expect(
      screen.getByRole("button", { name: /ir para o início/i }),
    ).toHaveFocus();
  });

  it("renders the shared How It Works explanation when selecting Como Funciona", async () => {
    const { user } = render(<Home />);

    await user.click(screen.getByRole("button", { name: "Como Funciona" }));

    expect(
      screen.getByRole("heading", { name: HELPA_JOURNEY_TITLE }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Homologação de Presença e Carga Horária",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/feedback do coordenador/i)).toBeNull();
  });

  it("opens the How It Works tab directly when arriving with #como-funciona", () => {
    render(<Home />, { route: "/#como-funciona" });

    expect(
      screen.getByRole("heading", { name: /como o helpa funciona/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: HELPA_JOURNEY_TITLE }),
    ).toBeInTheDocument();
  });
});
