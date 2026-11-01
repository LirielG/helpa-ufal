import { describe, expect, it } from "vitest";
import { useLocation } from "react-router";
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

type TestUser = ReturnType<typeof userEvent.setup>;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function findHome() {
  return screen.findByRole("heading", { name: /como nasceu o helpa/i });
}

function findDashboard() {
  return screen.findByRole("combobox", { name: "Status" });
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

    it("sends a guest from /moderation to the login screen without rendering moderation", async () => {
      render(<AppRoutes />, { route: "/moderation" });

      expect(
        await screen.findByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Moderação de denúncias")).toBeNull();
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
    it("shows the home page to a guest at / without changing the URL", async () => {
      render(
        <>
          <AppRoutes />
          <LocationProbe />
        </>,
        { route: "/" },
      );

      expect(await findHome()).toBeInTheDocument();
      expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/);
    });

    it("lets a guest open the feed from the home page tabs", async () => {
      const { user } = render(<AppRoutes />, { route: "/" });

      await user.click(
        await screen.findByRole("button", { name: "Como Funciona" }),
      );
      expect(
        await screen.findByRole("heading", { name: /como o helpa funciona/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Ações" }));

      expect(await findDashboard()).toBeInTheDocument();
    });

    it("lets a guest reach the dashboard", async () => {
      render(<AppRoutes />, { route: "/dashboard" });

      expect(await findDashboard()).toBeInTheDocument();
    });

    it("selects the SIGAA tab when the dashboard opens with ?feed=sigaa", async () => {
      render(<AppRoutes />, { route: "/dashboard?feed=sigaa" });

      expect(
        await screen.findByRole("tab", { name: /sigaa/i }),
      ).toHaveAttribute("aria-selected", "true");
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
      expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
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
    // The screen itself does nothing about the 401: it just asks for its data
    // and the HTTP client takes the user back to the login page.
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
    // The route is public: a 401 there says nothing about the visitor's
    // session, so it must not log a signed-in user out.
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
      expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    });

    // Someone who once signed in on this browser scans a certificate's QR code
    // after the cookie expired: the session check fails, but they came to see
    // the result, not the login screen.
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
      expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    });
  });

  describe("fallback routes", () => {
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
