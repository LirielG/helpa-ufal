import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@/test";
import { Home } from "../Home";

// JSDOM doesn't implement window.matchMedia, so we must mock it to prevent 
// crashes when HomeHeader tries to listen for screen size changes.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("Home", () => {
  it("renders the header, the main about section, and the footer", () => {
    render(<Home />);

    // Verify the header is present
    expect(screen.getByRole("banner")).toBeInTheDocument();

    // Verify the main navigation is present
    expect(
      screen.getByRole("navigation", { name: /Navegação da página inicial/i })
    ).toBeInTheDocument();

    // Verify the main "Sobre o Projeto" (About the Project) heading is present
    expect(
      screen.getByRole("heading", { name: /Como Nasceu o Helpa/i })
    ).toBeInTheDocument();

    // Verify the footer is present
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("is keyboard navigable and the first Tab reaches a visible target", async () => {
    // The custom render setup usually exposes the user instance
    const { user } = render(<Home />);

    // Simulate pressing the "Tab" key once
    await user.tab();

    // The first focusable element should be the logo button in the header
    const firstFocusableElement = screen.getByRole("button", {
      name: /Ir para o início/i,
    });
    
    expect(firstFocusableElement).toHaveFocus();
  });
});
