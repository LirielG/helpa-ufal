import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import {
  API,
  HttpResponse,
  http,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import {
  INVALID_RESET_CODE_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from "@/features/auth/constants/messages";
import { GuestRoute } from "@/routes/GuestRoute";
import { useAuthStore } from "@/stores/authStore";
import { ForgotPassword } from "../ForgotPassword";
import { Login } from "../Login";
import { ResetPassword } from "../ResetPassword";

const INVALID_CODE_RESPONSE = {
  status: 422,
  code: "INVALID_RESET_CODE",
  message: "The reset code is invalid, expired or already used.",
  errors: [
    {
      field: "code",
      code: "INVALID_RESET_CODE",
      message: "The reset code is invalid, expired or already used.",
    },
  ],
};

function LocationHashProbe() {
  const location = useLocation();
  return <div data-testid="location-hash">{location.hash}</div>;
}

function renderResetPassword(route = "/reset-password") {
  return render(
    <>
      <Routes>
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPassword />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
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
      </Routes>
      <LocationHashProbe />
    </>,
    { route },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResetPassword", () => {
  describe("step 1 (code verification)", () => {
    it("configures the code field attributes and uppercase display", () => {
      renderResetPassword();

      const codeInput = screen.getByLabelText("Código");
      expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
      expect(codeInput).toHaveAttribute("autocapitalize", "characters");
      expect(codeInput).toHaveAttribute("spellcheck", "false");
      expect(codeInput).toHaveAttribute("maxlength", "12");
      expect(codeInput).toHaveClass("uppercase");
    });

    it("requires e-mail and non-empty code without calling the API", async () => {
      const onVerify = vi.fn();
      server.use(
        http.post(`${API}/auth/forgot-password/verify`, () => {
          onVerify();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { user } = renderResetPassword();

      await user.click(screen.getByRole("button", { name: "Continuar" }));

      expect(
        await screen.findByText("E-mail é obrigatório"),
      ).toBeInTheDocument();
      expect(screen.getByText("Código é obrigatório")).toBeInTheDocument();
      expect(onVerify).not.toHaveBeenCalled();
    });

    it("accepts a lowercase hyphenated code without client normalization beyond trim", async () => {
      let verifyBody: unknown;
      server.use(
        http.post(`${API}/auth/forgot-password/verify`, async ({ request }) => {
          verifyBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { user } = renderResetPassword();

      await user.type(screen.getByLabelText("E-mail"), " ana@ufal.br ");
      await user.type(screen.getByLabelText("Código"), " 7kq4-mx9t ");
      await user.click(screen.getByRole("button", { name: "Continuar" }));

      expect(await screen.findByLabelText("Nova senha")).toBeInTheDocument();
      expect(verifyBody).toEqual({
        email: "ana@ufal.br",
        code: "7kq4-mx9t",
      });
      // The code is kept in screen state and not shown again in step 2.
      expect(screen.queryByLabelText("Código")).toBeNull();
      expect(screen.queryByText(/7kq4-mx9t/i)).toBeNull();
    });

    it("pre-fills from #email and #code, strips the URL fragment, and goes straight to step 2 when valid", async () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      let verifyBody: unknown;
      server.use(
        http.post(`${API}/auth/forgot-password/verify`, async ({ request }) => {
          verifyBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderResetPassword(
        "/reset-password#email=ana%2Bhelpa%40ufal.br&code=ABCD1234",
      );

      expect(await screen.findByLabelText("Nova senha")).toBeInTheDocument();
      expect(screen.getByTestId("location-hash")).toHaveTextContent("");
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/reset-password");
      expect(verifyBody).toEqual({
        email: "ana+helpa@ufal.br",
        code: "ABCD1234",
      });
    });

    it("pre-fills #code and strips the fragment without calling verify when #email is absent", async () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      const onVerify = vi.fn();
      server.use(
        http.post(`${API}/auth/forgot-password/verify`, () => {
          onVerify();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderResetPassword("/reset-password#code=ABCD1234");

      expect(screen.getByLabelText("Código")).toHaveValue("ABCD1234");
      await waitFor(() =>
        expect(screen.getByTestId("location-hash")).toHaveTextContent(""),
      );
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/reset-password");
      expect(onVerify).not.toHaveBeenCalled();
    });

    it("stays on step 1 with field error and link when the e-mail link code is invalid", async () => {
      server.use(
        http.post(`${API}/auth/forgot-password/verify`, () =>
          HttpResponse.json(INVALID_CODE_RESPONSE, { status: 422 }),
        ),
      );

      const { user } = renderResetPassword(
        "/reset-password#email=ana%40ufal.br&code=ZZZZZZZZ",
      );

      expect(
        await screen.findByText(INVALID_RESET_CODE_MESSAGE),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail")).toHaveValue("ana@ufal.br");
      expect(screen.getByLabelText("Código")).toHaveValue("ZZZZZZZZ");

      await user.click(
        screen.getByRole("link", { name: "Pedir um novo código" }),
      );
      expect(await screen.findByLabelText("E-mail")).toHaveValue("ana@ufal.br");
    });

    it.each([
      [
        "422 INVALID_RESET_CODE",
        () => HttpResponse.json(INVALID_CODE_RESPONSE, { status: 422 }),
      ],
      [
        "400 VALIDATION_ERROR on code",
        () =>
          HttpResponse.json(
            {
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Validation error.",
              errors: [
                {
                  field: "code",
                  code: "VALIDATION_ERROR",
                  message: "Code must have 8 Crockford Base32 characters.",
                },
              ],
            },
            { status: 400 },
          ),
      ],
    ])(
      "shows the invalid code message and request-new-code link on %s",
      async (_label, respond) => {
        server.use(http.post(`${API}/auth/forgot-password/verify`, respond));

        const { user } = renderResetPassword();

        await user.type(screen.getByLabelText("E-mail"), "ana@ufal.br");
        await user.type(screen.getByLabelText("Código"), "ABC");
        await user.click(screen.getByRole("button", { name: "Continuar" }));

        expect(
          await screen.findByText(INVALID_RESET_CODE_MESSAGE),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: "Pedir um novo código" }),
        ).toHaveAttribute("href", "/forgot-password");
        expect(
          screen.queryByText(
            "The reset code is invalid, expired or already used.",
          ),
        ).toBeNull();
      },
    );

    it.each([
      [
        "429",
        () =>
          HttpResponse.json(
            {
              status: 429,
              code: "TOO_MANY_REQUESTS",
              message: "Too many requests.",
            },
            { status: 429 },
          ),
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      ],
      [
        "network failure",
        () => HttpResponse.error(),
        "Não foi possível conectar ao servidor. Tente novamente.",
      ],
      [
        "server error (500)",
        () =>
          HttpResponse.json(
            { status: 500, code: "INTERNAL_ERROR", message: "Internal error." },
            { status: 500 },
          ),
        "Não foi possível conectar ao servidor. Tente novamente.",
      ],
      [
        "generic 400",
        () =>
          HttpResponse.json(
            {
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Validation error.",
              errors: [{ field: "email", message: "Invalid email" }],
            },
            { status: 400 },
          ),
        "Não foi possível concluir. Tente novamente.",
      ],
    ])(
      "shows the expected alert on %s during verification",
      async (_label, respond, expected) => {
        server.use(http.post(`${API}/auth/forgot-password/verify`, respond));

        const { user } = renderResetPassword();

        await user.type(screen.getByLabelText("E-mail"), "ana@ufal.br");
        await user.type(screen.getByLabelText("Código"), "7KQ4-MX9T");
        await user.click(screen.getByRole("button", { name: "Continuar" }));

        expect(await screen.findByText(expected)).toBeInTheDocument();
      },
    );
  });

  describe("step 2 (new password)", () => {
    async function enterStep2() {
      const view = renderResetPassword(
        "/reset-password#email=ana%40ufal.br&code=7kq4-mx9t",
      );
      await screen.findByLabelText("Nova senha");
      return view;
    }

    it("shows PasswordGuidelines and blocks weak passwords and mismatched confirmation", async () => {
      const onReset = vi.fn();
      server.use(
        http.post(`${API}/auth/reset-password`, () => {
          onReset();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { user } = await enterStep2();

      expect(screen.getByText("A senha deve conter:")).toBeInTheDocument();
      expect(screen.getByText("Pelo menos 8 caracteres")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Nova senha"), "fraca");
      await user.type(screen.getByLabelText("Confirmar nova senha"), "outra");
      await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

      expect(
        await screen.findByText("A nova senha não atende aos requisitos."),
      ).toBeInTheDocument();
      expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
      expect(onReset).not.toHaveBeenCalled();
    });

    it("submits email, code and newPassword, redirects to /login with successMessage and stays signed out", async () => {
      let resetBody: unknown;
      server.use(
        http.post(`${API}/auth/reset-password`, async ({ request }) => {
          resetBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { user } = await enterStep2();

      await user.type(screen.getByLabelText("Nova senha"), "Nova@Senha1");
      await user.type(
        screen.getByLabelText("Confirmar nova senha"),
        "Nova@Senha1",
      );
      await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

      expect(
        await screen.findByText(RESET_PASSWORD_SUCCESS_MESSAGE),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Entrar" }),
      ).toBeInTheDocument();
      expect(useAuthStore.getState().user).toBeNull();
      expect(resetBody).toEqual({
        email: "ana@ufal.br",
        code: "7kq4-mx9t",
        newPassword: "Nova@Senha1",
      });
    });

    it("returns to step 1 with field error and link when the code expires between steps", async () => {
      server.use(
        http.post(`${API}/auth/reset-password`, () =>
          HttpResponse.json(INVALID_CODE_RESPONSE, { status: 422 }),
        ),
      );

      const { user } = await enterStep2();

      await user.type(screen.getByLabelText("Nova senha"), "Nova@Senha1");
      await user.type(
        screen.getByLabelText("Confirmar nova senha"),
        "Nova@Senha1",
      );
      await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

      expect(
        await screen.findByText(INVALID_RESET_CODE_MESSAGE),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Código")).toHaveValue("7kq4-mx9t");
      expect(screen.getByLabelText("E-mail")).toHaveValue("ana@ufal.br");
      expect(
        screen.getByRole("link", { name: "Pedir um novo código" }),
      ).toHaveAttribute("href", "/forgot-password");
    });

    it.each([
      [
        "429",
        () =>
          HttpResponse.json(
            {
              status: 429,
              code: "TOO_MANY_REQUESTS",
              message: "Too many requests.",
            },
            { status: 429 },
          ),
        "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      ],
      [
        "network failure",
        () => HttpResponse.error(),
        "Não foi possível conectar ao servidor. Tente novamente.",
      ],
      [
        "generic 400",
        () =>
          HttpResponse.json(
            {
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Weak password.",
              errors: [{ field: "newPassword", message: "Weak password." }],
            },
            { status: 400 },
          ),
        "Não foi possível concluir. Tente novamente.",
      ],
    ])(
      "stays on step 2 and shows the alert on %s",
      async (_label, respond, expected) => {
        server.use(http.post(`${API}/auth/reset-password`, respond));

        const { user } = await enterStep2();

        await user.type(screen.getByLabelText("Nova senha"), "Nova@Senha1");
        await user.type(
          screen.getByLabelText("Confirmar nova senha"),
          "Nova@Senha1",
        );
        await user.click(
          screen.getByRole("button", { name: "Redefinir senha" }),
        );

        expect(await screen.findByText(expected)).toBeInTheDocument();
        expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
      },
    );
  });
});
