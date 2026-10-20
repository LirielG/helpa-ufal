import { describe, expect, it, vi, beforeAll } from "vitest";
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
  waitFor,
} from "@/test";
import { useAuthStore } from "@/stores/authStore";
import { AppRoutes } from "../AppRoutes";

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

type TestUser = ReturnType<typeof userEvent.setup>;

function findDashboard() {
  return screen.findByRole("tablist", { name: /origem das ações/i });
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
      expect(screen.queryByText("Carregando...")).toBeNull();
    });

    it("sends a guest from the action edit screen to the login screen", async () => {
      render(<AppRoutes />, { route: "/activity/1/edit" });

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Carregando...")).toBeNull();
    });

    it("sends a guest from the dashboard to the login screen", async () => {
      render(<AppRoutes />, { route: "/dashboard" });

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
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

    it("lets a signed-in user reach /dashboard", async () => {
      signIn();

      render(<AppRoutes />, { route: "/dashboard" });

      expect(await findDashboard()).toBeInTheDocument();
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
    it("renders the Home page at root '/' without redirecting", async () => {
      render(<AppRoutes />, { route: "/" });

      expect(
        await screen.findByRole("heading", { name: /Como Nasceu o Helpa/i }),
      ).toBeInTheDocument();
    });

    it("renders the Como Funciona page and the public feed via tabs", async () => {
      const { user } = render(<AppRoutes />, { route: "/" });

      const howItWorksTab = await screen.findByRole("button", { name: "Como Funciona" });
      await user.click(howItWorksTab);

      expect(
        await screen.findByRole("heading", { name: /Como o Helpa Funciona/i }),
      ).toBeInTheDocument();
      
      const actionsTab = await screen.findByRole("button", { name: "Ações" });
      await user.click(actionsTab);
      
      expect(await findDashboard()).toBeInTheDocument();
    });

    it("lets a guest reach an action detail", async () => {
      render(<AppRoutes />, { route: "/activity/1" });

      expect(
        await screen.findByText("Oficina de Programação"),
      ).toBeInTheDocument();
    });

    it("lets a guest validate a certificate without being sent to login", async () => {
      render(<AppRoutes />, { route: "/validar/7KQ4MX9T2R" });

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /perfil/i })).toBeNull();
    });

    it("lets a signed-in user validate a certificate without being sent away", async () => {
      signIn();

      render(<AppRoutes />, { route: "/validar/7KQ4MX9T2R" });

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /perfil/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /sair/i })).toBeNull();
    });

    it("opens the empty validation form at /validar", async () => {
      render(<AppRoutes />, { route: "/validar" });

      expect(await screen.findByLabelText("Código de validação")).toHaveValue(
        "",
      );
    });
  });

  describe("expired session", () => {
    it("sends the user to login when a request reports an expired session", async () => {
      server.use(
        http.get(
          `${API}/users/me/activities`,
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

  describe("certificate validation", () => {
    it("keeps the session when the validation route answers 401", async () => {
      server.use(
        http.get(
          `${API}/certificate-validations/:validationCode`,
          () => new HttpResponse(null, { status: 401 }),
        ),
      );
      signIn();

      render(<AppRoutes />, { route: "/validar/7KQ4MX9T2R" });

      expect(
        await screen.findByText(/não foi possível consultar o certificado/i),
      ).toBeInTheDocument();
      expect(useAuthStore.getState().user).not.toBeNull();
    });

    it("shows the result when the restored session turns out to be expired", async () => {
      server.use(
        http.get(
          `${API}/users/me`,
          () => new HttpResponse(null, { status: 401 }),
        ),
      );
      signIn();

      render(<AppRoutes />, { route: "/validar/7KQ4MX9T2R" });

      expect(
        await screen.findByText("Certificado autêntico"),
      ).toBeInTheDocument();
      await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    });
  });

  describe("fallback routes", () => {
    it("renders 404 page for unknown route", async () => {
      render(<AppRoutes />, { route: "/rota-inexistente" });

      expect(
        await screen.findByText("Página não encontrada"),
      ).toBeInTheDocument();
    });
  });
});
