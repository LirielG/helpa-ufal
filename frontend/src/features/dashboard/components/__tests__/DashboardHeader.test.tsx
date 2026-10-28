import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import {
  CurrentUrl,
  render,
  renderWithAuthPages,
  screen,
  signIn,
  submitLoginForm,
} from "@/test";
import { DashboardShell } from "../DashboardShell";
import { DashboardHeader } from "../DashboardHeader";

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;
  return <h1>Login (de {from})</h1>;
}

function renderHeaderAt(route: string) {
  return render(
    <Routes>
      <Route
        path="/activity/:id"
        element={
          <DashboardShell header={<DashboardHeader />}>
            <p>Detalhe</p>
          </DashboardShell>
        }
      />
      <Route path="/login" element={<LoginProbe />} />
    </Routes>,
    { route },
  );
}

describe("DashboardHeader", () => {
  describe("for a visitor", () => {
    it("shows the logo, navigation tabs, Entrar and Cadastrar-se, but no profile or Sair", () => {
      renderHeaderAt("/activity/act-1");

      expect(
        screen.getByRole("button", { name: "Ir para a página inicial" }),
      ).toBeInTheDocument();
      
      expect(screen.getByRole("button", { name: "Sobre o Projeto" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Como Funciona" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ações" })).toBeInTheDocument();

      expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cadastrar-se" })).toBeInTheDocument();

      expect(screen.queryByRole("button", { name: "Abrir perfil" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    });

    it("sends Entrar to the login, remembering the current page", async () => {
      const { user } = renderHeaderAt("/activity/act-1");

      await user.click(screen.getByRole("button", { name: "Entrar" }));

      expect(
        screen.getByRole("heading", { name: "Login (de /activity/act-1)" }),
      ).toBeInTheDocument();
    });
  });

  it("brings a visitor who signs in from Entrar back to the same page, query string included", async () => {
    const { user } = renderWithAuthPages(
      "/activity/:id",
      <DashboardShell header={<DashboardHeader />}>
        <CurrentUrl />
      </DashboardShell>,
      "/activity/act-1?origem=compartilhado",
    );

    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await submitLoginForm(user);

    expect(
      await screen.findByRole("status", { name: "URL atual" }),
    ).toHaveTextContent("/activity/act-1?origem=compartilhado");
  });

  describe("for a signed-in user", () => {
    it("shows the logo, but no Entrar, Cadastrar-se or visitor tabs", () => {
      signIn({ fullName: "Maria Souza" });
      renderHeaderAt("/activity/act-1");

      expect(screen.getByRole("button", { name: "Ir para a página inicial" })).toBeInTheDocument();
      
      // O dropdown de perfil antigo do Header não existe mais
      expect(screen.queryByRole("button", { name: "Abrir perfil" })).not.toBeInTheDocument();
      
      // Elementos exclusivos de visitante não devem existir para quem está logado
      expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cadastrar-se" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Sobre o Projeto" })).not.toBeInTheDocument();
      
      // O botão "Sair" não é mais testado como ausente aqui, pois a DashboardShell o renderiza através da Sidebar.
    });
  });
});
