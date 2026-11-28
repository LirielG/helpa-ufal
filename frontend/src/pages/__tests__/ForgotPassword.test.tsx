import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  HttpResponse,
  delay,
  http,
  render,
  screen,
  server,
  within,
} from "@/test";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "@/features/auth/constants/messages";
import { ForgotPassword } from "../ForgotPassword";
import { Login } from "../Login";
import { ResetPassword } from "../ResetPassword";

function renderForgotPassword() {
  return render(
    <Routes>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<Login />} />
    </Routes>,
    {
      route: "/forgot-password",
    },
  );
}

describe("ForgotPassword", () => {
  it("renders the heading, supporting text, e-mail field, submit button and login footer link", () => {
    renderForgotPassword();

    expect(
      screen.getByRole("heading", { name: "Esqueci minha senha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Informe o e-mail da sua conta. Enviaremos um código para você criar uma nova senha.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar código" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/lembrou a senha\?/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "Entrar" }),
    ).toHaveAttribute("href", "/login");
  });

  it("pre-fills the e-mail field from route state", async () => {
    const { user } = render(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>,
      { route: "/login" },
    );

    await user.type(screen.getByLabelText("Usuário"), "maria@ufal.br");
    await user.click(screen.getByRole("link", { name: "Esqueci minha senha" }));

    expect(await screen.findByLabelText("E-mail")).toHaveValue("maria@ufal.br");
  });

  it("validates empty and malformed e-mails without calling the API", async () => {
    const onRequest = vi.fn();
    server.use(
      http.post(`${API}/auth/forgot-password`, () => {
        onRequest();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderForgotPassword();

    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("E-mail é obrigatório")).toBeInTheDocument();
    expect(onRequest).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("E-mail"), "usuario@ufal");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it.each(["maria@ufal.br", "desconhecido@ufal.br"])(
    "shows the same neutral success alert after 204 for %s",
    async (email) => {
      let capturedBody: unknown;
      server.use(
        http.post(`${API}/auth/forgot-password`, async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { user } = renderForgotPassword();

      await user.type(screen.getByLabelText("E-mail"), email);
      await user.click(screen.getByRole("button", { name: "Enviar código" }));

      expect(
        await screen.findByText(FORGOT_PASSWORD_SUCCESS_MESSAGE),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("E-mail")).toBeNull();
      expect(
        screen.getByRole("link", { name: "Já tenho um código" }),
      ).toHaveAttribute("href", "/reset-password");
      expect(
        screen.getByRole("button", { name: "Enviar novamente" }),
      ).toBeInTheDocument();
      expect(capturedBody).toEqual({ email });
    },
  );

  it("passes the submitted e-mail when following 'Já tenho um código'", async () => {
    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText(FORGOT_PASSWORD_SUCCESS_MESSAGE);

    await user.click(screen.getByRole("link", { name: "Já tenho um código" }));

    expect(
      await screen.findByRole("heading", { name: "Redefinir senha" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@ufal.br");
  });

  it("returns to the form keeping the typed e-mail when clicking 'Enviar novamente'", async () => {
    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText(FORGOT_PASSWORD_SUCCESS_MESSAGE);

    await user.click(screen.getByRole("button", { name: "Enviar novamente" }));

    expect(await screen.findByLabelText("E-mail")).toHaveValue("maria@ufal.br");
    expect(screen.queryByText(FORGOT_PASSWORD_SUCCESS_MESSAGE)).toBeNull();
  });

  it("disables the button while the request is in flight", async () => {
    server.use(
      http.post(`${API}/auth/forgot-password`, async () => {
        await delay("infinite");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    const submitButton = await screen.findByRole("button", {
      name: "Carregando...",
    });
    expect(submitButton).toBeDisabled();
  });

  it("shows the rate-limit alert on 429 and ignores the API message", async () => {
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        HttpResponse.json(
          {
            status: 429,
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please try again later.",
          },
          { status: 429 },
        ),
      ),
    );

    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    expect(
      await screen.findByText(
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Too many requests. Please try again later."),
    ).toBeNull();
  });

  it.each([
    ["network failure", () => HttpResponse.error()],
    [
      "server error (500)",
      () =>
        HttpResponse.json(
          { status: 500, code: "INTERNAL_ERROR", message: "Internal error." },
          { status: 500 },
        ),
    ],
  ])("shows the connection error on %s", async (_label, respond) => {
    server.use(http.post(`${API}/auth/forgot-password`, respond));

    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    expect(
      await screen.findByText(
        "Não foi possível conectar ao servidor. Tente novamente.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the generic error on 400 and ignores the API message", async () => {
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        HttpResponse.json(
          {
            status: 400,
            code: "VALIDATION_ERROR",
            message: "Validation error.",
          },
          { status: 400 },
        ),
      ),
    );

    const { user } = renderForgotPassword();

    await user.type(screen.getByLabelText("E-mail"), "maria@ufal.br");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    expect(
      await screen.findByText("Não foi possível concluir. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Validation error.")).toBeNull();
  });
});
