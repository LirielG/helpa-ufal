import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import {
  act,
  CurrentUrl,
  makeUser,
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
        screen.getByRole("button", {
          name: "Ir para a página inicial do Helpa",
        }),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: "Sobre o Projeto" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Como Funciona" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ações" })).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cadastrar-se" }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", { name: "Abrir perfil" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sair" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Denúncias" }),
      ).not.toBeInTheDocument();
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

      expect(
        screen.getByRole("button", {
          name: "Ir para a página inicial do Helpa",
        }),
      ).toBeInTheDocument();

      // O dropdown de perfil antigo do Header não existe mais
      expect(
        screen.queryByRole("button", { name: "Abrir perfil" }),
      ).not.toBeInTheDocument();

      // Elementos exclusivos de visitante não devem existir para quem está logado
      expect(
        screen.queryByRole("button", { name: "Entrar" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cadastrar-se" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sobre o Projeto" }),
      ).not.toBeInTheDocument();

      // O botão "Sair" não é mais testado como ausente aqui, pois a DashboardShell o renderiza através da Sidebar.
    });
  });

  it("keeps the logo in place when the initial session check finishes", () => {
    localStorage.setItem("help_auth_token", "token");
    // Through the shell, which passes onToggleSidebar: the signed-in header then puts the menu button before the logo.
    render(
      <DashboardShell header={<DashboardHeader />}>
        <p>Feed</p>
      </DashboardShell>,
    );

    const verifyingLayout = layoutOfHeader();

    act(() => {
      useAuthStore.setState({ user: makeUser(), isSessionVerified: true });
    });

    expect(
      screen.getByRole("button", { name: "Ir para a página inicial do Helpa" }),
    ).toBeInTheDocument();
    expect(layoutOfHeader()).toEqual(verifyingLayout);
  });
});

// What decides where the logo is drawn: the row's width and padding, the group holding the logo,
// the size of the slot before it (the menu button below lg), and the logo's own size.
function layoutOfHeader() {
  const row = screen.getByRole("banner").firstElementChild;
  const group = row?.firstElementChild;
  const slot = group?.children.length === 2 ? group.firstElementChild : null;
  return {
    row: row?.className,
    group: group?.className,
    slot: slot && {
      hiddenFromLg: slot.classList.contains("lg:hidden"),
      padding: slot.classList.contains("p-2"),
      icon: slot.firstElementChild?.classList.contains("size-6"),
    },
    logo: screen.getByAltText("helpa").className,
  };
}
