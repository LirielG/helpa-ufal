import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { Home } from "../Home";

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
});
