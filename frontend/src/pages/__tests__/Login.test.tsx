import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  HttpResponse,
  delay,
  http,
  makeLoginRequest,
  makeUser,
  render,
  screen,
  server,
  userEvent,
} from "@/test";
import type { LoginRequest } from "@/types";
import { GuestRoute } from "@/routes/GuestRoute";
import { Login } from "../Login";

type TestUser = ReturnType<typeof userEvent.setup>;

/**
 * The destination route is part of the tree so the redirect is observed
 * through what ends up on screen, rather than by spying on `useNavigate`.
 * `GuestRoute` is part of it too because it, not this screen, decides where a
 * successful login lands.
 */
function renderLoginWithDashboard() {
  return render(
    <Routes>
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
    { route: "/login" },
  );
}

async function submitLogin(user: TestUser, credentials: LoginRequest) {
  await user.type(screen.getByLabelText("Usuário"), credentials.email);
  await user.type(screen.getByLabelText("Senha"), credentials.password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

/**
 * Replaces the login handler with a spy, so a test can assert that form
 * validation stopped the submission before any request went out.
 */
function spyOnLoginRequest() {
  const onRequest = vi.fn();

  server.use(
    http.post(`${API}/auth/login`, () => {
      onRequest();
      return HttpResponse.json({ token: "test-token", user: makeUser() });
    }),
  );

  return onRequest;
}

describe("Login", () => {
  it("shows the e-mail and password fields and the submit button", () => {
    render(<Login />, { route: "/login" });

    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("goes to the dashboard when the credentials are accepted", async () => {
    const { user } = renderLoginWithDashboard();
    const credentials = makeLoginRequest();

    await submitLogin(user, credentials);

    expect(
      await screen.findByRole("heading", { name: "Painel" }),
    ).toBeInTheDocument();
  });

  it("requires both fields when the form is submitted empty", async () => {
    const onLoginRequest = spyOnLoginRequest();
    const { user } = renderLoginWithDashboard();

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Senha é obrigatória")).toBeInTheDocument();
    expect(onLoginRequest).not.toHaveBeenCalled();
  });

  // "usuario@ufal" clears the native <input type="email"> check, which does not
  // require a full domain, so only the app's own schema rejects it.
  it("rejects a malformed e-mail without calling the API", async () => {
    const onLoginRequest = spyOnLoginRequest();
    const { user } = renderLoginWithDashboard();

    await submitLogin(user, makeLoginRequest({ email: "usuario@ufal" }));

    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(onLoginRequest).not.toHaveBeenCalled();
  });

  it("shows the error message returned by the server and stays on login", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { message: "Credenciais inválidas" },
          { status: 401 },
        ),
      ),
    );

    const { user } = renderLoginWithDashboard();
    const credentials = makeLoginRequest();

    await submitLogin(user, credentials);

    expect(
      await screen.findByText("Credenciais inválidas"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Painel" })).toBeNull();
  });

  it("shows a communication error when the server fails without a message", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );

    const { user } = renderLoginWithDashboard();
    const credentials = makeLoginRequest();

    await submitLogin(user, credentials);

    expect(
      await screen.findByText("Erro na comunicação com o servidor"),
    ).toBeInTheDocument();
  });

  it("disables the button and signals loading while the login is in flight", async () => {
    // The response never arrives, so the form stays in its submitting state.
    server.use(
      http.post(`${API}/auth/login`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );

    const { user } = renderLoginWithDashboard();
    const credentials = makeLoginRequest();

    await submitLogin(user, credentials);

    const submitButton = await screen.findByRole("button", {
      name: "Carregando...",
    });
    expect(submitButton).toBeDisabled();
  });

  it("toggles password visibility", async () => {
    const { user } = render(<Login />, { route: "/login" });
    const passwordInput = screen.getByLabelText("Senha");

    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar senha" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
