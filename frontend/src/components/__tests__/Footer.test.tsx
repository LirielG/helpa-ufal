import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { CurrentUrl, render, screen, signIn, signOut, within } from "@/test";
import { Footer } from "../Footer";

function renderFooter(route = "/activity/act-1") {
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
    it("renders Sobre o projeto, Entrar, Criar conta and Validar certificado in order without Contato or dead links", () => {
      signOut();
      renderFooter();

      const footer = screen.getByRole("contentinfo");
      const links = within(footer).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual([
        "Sobre o projeto",
        "Entrar",
        "Criar conta",
        "Validar certificado",
      ]);

      expect(links[0]).toHaveAttribute("href", "/");
      expect(links[1]).toHaveAttribute("href", "/login");
      expect(links[2]).toHaveAttribute("href", "/register");
      expect(links[3]).toHaveAttribute("href", "/validate");

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
      ["Validar certificado", "/validate"],
    ] as const)(
      "navigates to %s (%s) when clicked",
      async (label, expectedPath) => {
        signOut();
        const { user } = renderFooter("/activity/act-1");

        const link = screen.getByRole("link", { name: label });
        expect(link).toBeVisible();
        await user.click(link);

        expect(
          screen.getByRole("status", { name: "URL atual" }),
        ).toHaveTextContent(expectedPath);
      },
    );

    it("opens Validar certificado via keyboard", async () => {
      signOut();
      const { user } = renderFooter("/activity/act-1");

      const link = screen.getByRole("link", { name: "Validar certificado" });
      link.focus();
      expect(link).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(
        screen.getByRole("status", { name: "URL atual" }),
      ).toHaveTextContent("/validate");
    });
  });

  describe("for a signed-in user", () => {
    it("renders Ações, Meu perfil and Validar certificado in order without visitor links or Contato", () => {
      signIn();
      renderFooter();

      const footer = screen.getByRole("contentinfo");
      const links = within(footer).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual([
        "Ações",
        "Meu perfil",
        "Validar certificado",
      ]);

      expect(links[0]).toHaveAttribute("href", "/dashboard");
      expect(links[1]).toHaveAttribute("href", "/profile");
      expect(links[2]).toHaveAttribute("href", "/validate");

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
      ["Validar certificado", "/validate"],
    ] as const)(
      "navigates to %s (%s) when clicked",
      async (label, expectedPath) => {
        signIn();
        const { user } = renderFooter("/activity/act-1");

        const link = screen.getByRole("link", { name: label });
        expect(link).toBeVisible();
        await user.click(link);

        expect(
          screen.getByRole("status", { name: "URL atual" }),
        ).toHaveTextContent(expectedPath);
      },
    );
  });
});
