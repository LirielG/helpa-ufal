import { describe, expect, it } from "vitest";
import {
  API,
  HttpResponse,
  http,
  makeLoginRequest,
  render,
  screen,
  server,
  signIn,
  userEvent,
} from "@/test";
import { useAuthStore } from "@/stores/authStore";
import { AppRoutes } from "../AppRoutes";

type TestUser = ReturnType<typeof userEvent.setup>;

function findDashboard() {
  return screen.findByRole("combobox", { name: "Filtrar por disponibilidade" });
}

async function submitLogin(user: TestUser) {
  const credentials = makeLoginRequest();

  await user.type(screen.getByLabelText("Usuário"), credentials.email);
  await user.type(screen.getByLabelText("Senha"), credentials.password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("AppRoutes", () => {
  describe("protected routes", () => {
    it("sends a guest from /profile to the login screen without rendering the profile", async () => {
      render(<AppRoutes />, { route: "/profile" });

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      // Profile paints "Carregando..." on mount, so its absence proves the
      // screen never mounted, rather than merely not having finished loading.
      expect(screen.queryByText("Carregando...")).toBeNull();
    });

    it("sends a guest from the action edit screen to the login screen", async () => {
      render(<AppRoutes />, { route: "/activity/1/edit" });

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Carregando...")).toBeNull();
    });

    it("returns the user to the route they tried to reach after logging in", async () => {
      const { user } = render(<AppRoutes />, { route: "/profile" });

      await screen.findByRole("button", { name: "Entrar" });
      await submitLogin(user);

      expect(await screen.findByText("Dados Pessoais")).toBeInTheDocument();
    });

    it("lets a signed-in user reach /profile", async () => {
      signIn();

      render(<AppRoutes />, { route: "/profile" });

      expect(await screen.findByText("Dados Pessoais")).toBeInTheDocument();
    });

    it("drops the user on the login screen when they log out of /profile", async () => {
      signIn();
      const { user } = render(<AppRoutes />, { route: "/profile" });

      await user.click(await screen.findByRole("button", { name: /sair/i }));

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
    });
  });

  describe("guest-only routes", () => {
    it("sends a signed-in user from /login to the dashboard", async () => {
      signIn();

      render(<AppRoutes />, { route: "/login" });

      expect(await findDashboard()).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    });

    it("sends a signed-in user from /register to the dashboard", async () => {
      signIn();

      render(<AppRoutes />, { route: "/register" });

      expect(await findDashboard()).toBeInTheDocument();
    });
  });

  describe("public routes", () => {
    it("lets a guest reach the dashboard", async () => {
      render(<AppRoutes />, { route: "/dashboard" });

      expect(await findDashboard()).toBeInTheDocument();
    });

    it("lets a guest reach an action detail", async () => {
      render(<AppRoutes />, { route: "/activity/1" });

      expect(
        await screen.findByText("Oficina de Programação"),
      ).toBeInTheDocument();
    });
  });

  describe("expired session", () => {
    // The screen itself does nothing about the 401: it just asks for its data
    // and the HTTP client takes the user back to the login page.
    it("sends the user to login when a request reports an expired session", async () => {
      server.use(
        http.get(
          `${API}/activities`,
          () => new HttpResponse(null, { status: 401 }),
        ),
      );
      signIn();
      const { user } = render(<AppRoutes />, { route: "/profile" });

      await user.click(await screen.findByRole("button", { name: "Ações" }));

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("fallback routes", () => {
    it("takes a guest from / to the dashboard", async () => {
      render(<AppRoutes />, { route: "/" });

      expect(await findDashboard()).toBeInTheDocument();
    });

    it("takes a signed-in user from / to the dashboard", async () => {
      signIn();

      render(<AppRoutes />, { route: "/" });

      expect(await findDashboard()).toBeInTheDocument();
    });

    it("renders 404 page for unknown route", async () => {
      render(<AppRoutes />, { route: "/rota-inexistente" });

      expect(
        await screen.findByText("Página não encontrada"),
      ).toBeInTheDocument();
    });
  });
});
