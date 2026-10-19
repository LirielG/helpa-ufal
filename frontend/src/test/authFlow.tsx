import type { ReactElement } from "react";
import { Route, Routes, useLocation } from "react-router";
import { screen } from "@testing-library/react";
import { GuestRoute } from "@/routes/GuestRoute";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import type { LoginRequest } from "@/types";
import { makeLoginRequest } from "./factories";
import { renderWithProviders, type RenderWithProvidersResult } from "./render";

type TestUser = RenderWithProvidersResult["user"];

/** Prints the full URL, so a test can tell a query string survived a redirect. */
export function CurrentUrl() {
  const { pathname, search } = useLocation();
  return <output aria-label="URL atual">{pathname + search}</output>;
}

/**
 * Mounts a page next to the real login and sign-up screens, both behind
 * GuestRoute as in AppRoutes, so a visitor's round trip through them ends
 * wherever GuestRoute decides.
 */
export function renderWithAuthPages(
  path: string,
  page: ReactElement,
  route: string,
): RenderWithProvidersResult {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={page} />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route path="/dashboard" element={<h1>Painel</h1>} />
    </Routes>,
    { route },
  );
}

export async function submitLoginForm(
  user: TestUser,
  credentials: LoginRequest = makeLoginRequest(),
) {
  // Awaited because a sign-up only lands here once its request resolves.
  await user.type(await screen.findByLabelText("Usuário"), credentials.email);
  await user.type(screen.getByLabelText("Senha"), credentials.password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

/** Fills and submits the student sign-up, which lands on the login screen. */
export async function submitStudentSignUpForm(user: TestUser) {
  await user.click(screen.getByRole("button", { name: /estudante/i }));
  await user.type(
    screen.getByPlaceholderText("Digite seu nome completo"),
    "Jéssica Pereira da Silva",
  );
  await user.type(
    screen.getByPlaceholderText("seu.email@exemplo.com"),
    "jessica@ufal.br",
  );
  await user.type(
    screen.getByPlaceholderText("Ex.: Ciência da Computação"),
    "Ciência da Computação",
  );
  await user.type(
    screen.getByPlaceholderText("Número de matrícula"),
    "2023001122",
  );
  await user.type(screen.getByPlaceholderText("Digite sua senha"), "Senha@123");
  await user.type(
    screen.getByPlaceholderText("Digite a senha novamente"),
    "Senha@123",
  );
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
}
