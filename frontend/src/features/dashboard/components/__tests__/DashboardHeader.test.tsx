import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import { makeLoginRequest, render, screen, signIn } from "@/test";
import { GuestRoute } from "@/routes/GuestRoute";
import { Login } from "@/pages/Login";
import { DashboardShell } from "../DashboardShell";
import { DashboardHeader } from "../DashboardHeader";

/** Shows where the visitor was sent from, as GuestRoute will read it. */
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
    it("shows the logo, Criar uma ação and Entrar, but no profile or Sair", () => {
      renderHeaderAt("/activity/act-1");

      expect(
        screen.getByRole("button", { name: "Ir para a página inicial" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Criar uma ação" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Abrir perfil" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sair" }),
      ).not.toBeInTheDocument();
    });

    it("sends Criar uma ação to the login without opening the modal", async () => {
      const { user } = renderHeaderAt("/activity/act-1");

      await user.click(screen.getByRole("button", { name: "Criar uma ação" }));

      expect(
        screen.getByRole("heading", { name: "Login (de /activity/act-1)" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Vamos criar uma ação?"),
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

  it("brings a visitor who signs in from Entrar back to the same action", async () => {
    const { user } = render(
      <Routes>
        <Route
          path="/activity/:id"
          element={
            <DashboardShell header={<DashboardHeader />}>
              <p>Detalhe</p>
            </DashboardShell>
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route path="/dashboard" element={<h1>Painel</h1>} />
      </Routes>,
      { route: "/activity/act-1" },
    );
    const credentials = makeLoginRequest();

    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await user.type(screen.getByLabelText("Usuário"), credentials.email);
    await user.type(screen.getByLabelText("Senha"), credentials.password);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Detalhe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir perfil" }),
    ).toBeInTheDocument();
  });

  describe("for a signed-in user", () => {
    it("shows Criar uma ação, the profile and Sair, but no Entrar", () => {
      signIn({ fullName: "Maria Souza" });
      renderHeaderAt("/activity/act-1");

      expect(
        screen.getByRole("button", { name: "Criar uma ação" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Abrir perfil" }),
      ).toHaveTextContent("Maria");
      expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Entrar" }),
      ).not.toBeInTheDocument();
    });

    it("opens the modal from Criar uma ação", async () => {
      signIn();
      const { user } = renderHeaderAt("/activity/act-1");

      await user.click(screen.getByRole("button", { name: "Criar uma ação" }));

      expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
    });
  });
});
