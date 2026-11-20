import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { CurrentUrl, render, screen, signIn, signOut, within } from "@/test";
import { Footer } from "../Footer";

function renderFooter(route = "/validar") {
  return render(
    <Routes>
      <Route
        path="*"
        element={
          <>
            <CurrentUrl />
            <Footer />
          </>
        }
      />
    </Routes>,
    { route },
  );
}

describe("Footer", () => {
  describe("for a visitor", () => {
    it("renders Sobre o projeto, Entrar and Criar conta in order without Contato or dead links", () => {
      signOut();
      renderFooter();

      const footer = screen.getByRole("contentinfo");
      const links = within(footer).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual([
        "Sobre o projeto",
        "Entrar",
        "Criar conta",
      ]);

      expect(links[0]).toHaveAttribute("href", "/");
      expect(links[1]).toHaveAttribute("href", "/login");
      expect(links[2]).toHaveAttribute("href", "/register");

      expect(
        within(footer).queryByRole("heading", { name: "Contato" }),
      ).not.toBeInTheDocument();
      expect(
        within(footer).queryByText(/helpa@universidade\.edu\.br/i),
      ).not.toBeInTheDocument();
      expect(
        footer.querySelector('a[href="#"], a[href^="mailto:"]'),
      ).toBeNull();
    });

    it.each([
      ["Sobre o projeto", "/"],
      ["Entrar", "/login"],
      ["Criar conta", "/register"],
    ] as const)(
      "navigates to %s (%s) when clicked",
      async (label, expectedPath) => {
        signOut();
        const { user } = renderFooter("/validar");

        await user.click(screen.getByRole("link", { name: label }));

        expect(
          screen.getByRole("status", { name: "URL atual" }),
        ).toHaveTextContent(expectedPath);
      },
    );
  });

  describe("for a signed-in user", () => {
    it("renders Ações and Meu perfil in order without visitor links or Contato", () => {
      signIn();
      renderFooter();

      const footer = screen.getByRole("contentinfo");
      const links = within(footer).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual([
        "Ações",
        "Meu perfil",
      ]);

      expect(links[0]).toHaveAttribute("href", "/dashboard");
      expect(links[1]).toHaveAttribute("href", "/profile");

      expect(
        within(footer).queryByRole("link", { name: "Sobre o projeto" }),
      ).not.toBeInTheDocument();
      expect(
        within(footer).queryByRole("link", { name: "Entrar" }),
      ).not.toBeInTheDocument();
      expect(
        within(footer).queryByRole("link", { name: "Criar conta" }),
      ).not.toBeInTheDocument();
      expect(
        within(footer).queryByRole("heading", { name: "Contato" }),
      ).not.toBeInTheDocument();
      expect(
        footer.querySelector('a[href="#"], a[href^="mailto:"]'),
      ).toBeNull();
    });

    it.each([
      ["Ações", "/dashboard"],
      ["Meu perfil", "/profile"],
    ] as const)(
      "navigates to %s (%s) when clicked",
      async (label, expectedPath) => {
        signIn();
        const { user } = renderFooter("/validar");

        await user.click(screen.getByRole("link", { name: label }));

        expect(
          screen.getByRole("status", { name: "URL atual" }),
        ).toHaveTextContent(expectedPath);
      },
    );
  });
});
