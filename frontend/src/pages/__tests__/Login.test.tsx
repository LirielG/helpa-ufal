import { describe, expect, it, vi } from "vitest";
import { Link, Route, Routes } from "react-router";
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
  submitLoginForm,
} from "@/test";
import { GuestRoute } from "@/routes/GuestRoute";
import { Login } from "../Login";

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

    await submitLoginForm(user, credentials);

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

    await submitLoginForm(user, makeLoginRequest({ email: "usuario@ufal" }));

    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(onLoginRequest).not.toHaveBeenCalled();
  });

  it("translates wrong credentials and stays on login", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          {
            status: 401,
            code: "UNAUTHENTICATED",
            message: "Invalid credentials.",
          },
          { status: 401 },
        ),
      ),
    );

    const { user } = renderLoginWithDashboard();

    await submitLoginForm(user, makeLoginRequest());

    expect(
      await screen.findByText("E-mail ou senha incorretos."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Invalid credentials.")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Painel" })).toBeNull();
  });

  it("shows the same text whatever the API message says", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          {
            status: 401,
            code: "UNAUTHENTICATED",
            message: "Any other wording.",
          },
          { status: 401 },
        ),
      ),
    );

    const { user } = renderLoginWithDashboard();

    await submitLoginForm(user, makeLoginRequest());

    expect(
      await screen.findByText("E-mail ou senha incorretos."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Any other wording.")).toBeNull();
  });

  it("drops a failed login's message once the visitor leaves the screen", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          {
            status: 401,
            code: "UNAUTHENTICATED",
            message: "Invalid credentials.",
          },
          { status: 401 },
        ),
      ),
    );
    const { user } = render(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Link to="/login">Voltar</Link>} />
      </Routes>,
      { route: "/login" },
    );

    await submitLoginForm(user, makeLoginRequest());
    await screen.findByText("E-mail ou senha incorretos.");
    await user.click(screen.getByRole("link", { name: "Criar conta" }));
    await user.click(screen.getByRole("link", { name: "Voltar" }));

    expect(await screen.findByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.queryByText("E-mail ou senha incorretos.")).toBeNull();
  });

  it.each([
    ["the request gets no response", () => HttpResponse.error()],
    [
      "the server fails",
      () =>
        HttpResponse.json(
          { status: 500, code: "INTERNAL_ERROR", message: "Internal error." },
          { status: 500 },
        ),
    ],
  ])("shows the connection error when %s", async (_case, respond) => {
    server.use(http.post(`${API}/auth/login`, respond));

    const { user } = renderLoginWithDashboard();

    await submitLoginForm(user, makeLoginRequest());

    expect(
      await screen.findByText(
        "Não foi possível conectar ao servidor. Tente novamente.",
      ),
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

    await submitLoginForm(user, credentials);

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
