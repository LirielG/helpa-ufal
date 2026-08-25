import { Route, Routes } from "react-router";
import { delay } from "msw";
import { describe, expect, it } from "vitest";
import type { UserEvent } from "@testing-library/user-event";
import { render, screen, http, HttpResponse, server } from "@/test";
import { makeUser } from "@/test";
import { config } from "@/config";
import { GuestRoute } from "@/routes/GuestRoute";
import { Register } from "../Register";

const REGISTER_URL = `${config.apiUrl}/auth/register`;

/**
 * Renders <Register/> at "/register" with a "/dashboard" route to land on after
 * success. `GuestRoute` is part of the tree because it, not this screen,
 * decides where a successful sign-up lands.
 */
function renderRegisterPage() {
  return render(
    <Routes>
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route path="/dashboard" element={<p>Bem-vindo ao painel</p>} />
    </Routes>,
    { route: "/register" },
  );
}

async function goToStudentForm(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: /estudante/i }));
}

async function goToTeacherForm(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: /docente/i }));
}

type FormOverrides = Partial<{
  name: string;
  email: string;
  course: string;
  registrationCode: string;
  password: string;
  confirmPassword: string;
  cndb: string;
}>;

async function fillCommonFields(
  user: UserEvent,
  overrides: FormOverrides = {},
) {
  await user.type(
    screen.getByPlaceholderText("Digite seu nome completo"),
    overrides.name ?? "Jéssica Pereira da Silva",
  );
  await user.type(
    screen.getByPlaceholderText("seu.email@exemplo.com"),
    overrides.email ?? "jessica@ufal.br",
  );
  await user.type(
    screen.getByPlaceholderText("Ex.: Ciência da Computação"),
    overrides.course ?? "Ciência da Computação",
  );
  await user.type(
    screen.getByPlaceholderText("Número de matrícula"),
    overrides.registrationCode ?? "2023001122",
  );
  await user.type(
    screen.getByPlaceholderText("Digite sua senha"),
    overrides.password ?? "Senha@123",
  );
  await user.type(
    screen.getByPlaceholderText("Digite a senha novamente"),
    overrides.confirmPassword ?? "Senha@123",
  );
}

describe("Register page", () => {
  describe("profile selection step", () => {
    it("shows the profile choice before any form field", () => {
      renderRegisterPage();

      expect(
        screen.getByRole("heading", { name: "Criar conta no helpa" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /docente/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /estudante/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Digite seu nome completo"),
      ).not.toBeInTheDocument();
    });

    it("opens the student form without a CNDB field", async () => {
      const { user } = renderRegisterPage();
      await goToStudentForm(user);

      expect(
        screen.getByRole("heading", { name: "Cadastro de Estudante" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Ex.: Número da carteira docente"),
      ).not.toBeInTheDocument();
    });

    it("opens the teacher form with the CNDB field", async () => {
      const { user } = renderRegisterPage();
      await goToTeacherForm(user);

      expect(
        screen.getByRole("heading", { name: "Cadastro de Docente" }),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Ex.: Número da carteira docente"),
      ).toBeInTheDocument();
    });

    it("returns to the selection screen and clears the form on 'Voltar'", async () => {
      const { user } = renderRegisterPage();
      await goToStudentForm(user);
      await user.type(
        screen.getByPlaceholderText("Digite seu nome completo"),
        "Texto que deve ser descartado",
      );

      await user.click(
        screen.getByRole("button", {
          name: /voltar para a seleção de cadastro/i,
        }),
      );

      expect(
        screen.getByRole("heading", { name: "Criar conta no helpa" }),
      ).toBeInTheDocument();

      await goToStudentForm(user);
      expect(
        screen.getByPlaceholderText("Digite seu nome completo"),
      ).toHaveValue("");
    });

    it("toggling one password field's visibility also reveals the other", async () => {
      // Register.tsx wires both PasswordField instances to a single
      // showPassword state, so clicking either "eye" icon flips both
      // fields together. This locks in that shared behavior explicitly.
      const { user } = renderRegisterPage();
      await goToStudentForm(user);

      const passwordInput = screen.getByPlaceholderText("Digite sua senha");
      const confirmInput = screen.getByPlaceholderText(
        "Digite a senha novamente",
      );
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(confirmInput).toHaveAttribute("type", "password");

      const toggles = screen.getAllByRole("button", { name: "Mostrar senha" });
      expect(toggles).toHaveLength(2);
      await user.click(toggles[0]);

      expect(passwordInput).toHaveAttribute("type", "text");
      expect(confirmInput).toHaveAttribute("type", "text");

      // Clicking the *other* field's own toggle flips the shared state back,
      // hiding both fields again.
      const [, hideToggleOnConfirmField] = screen.getAllByRole("button", {
        name: "Ocultar senha",
      });
      await user.click(hideToggleOnConfirmField);

      expect(passwordInput).toHaveAttribute("type", "password");
      expect(confirmInput).toHaveAttribute("type", "password");
    });
  });

  describe("validation", () => {
    it("shows required-field errors when submitting an empty student form", async () => {
      const { user } = renderRegisterPage();
      await goToStudentForm(user);

      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
      expect(screen.getByText("E-mail é obrigatório")).toBeInTheDocument();
      expect(screen.getByText("Curso é obrigatório")).toBeInTheDocument();
      expect(
        screen.getByText("Código de matrícula é obrigatório"),
      ).toBeInTheDocument();
    });

    it("requires the CNDB field only for teachers", async () => {
      const { user } = renderRegisterPage();
      await goToTeacherForm(user);

      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(await screen.findByText("CNDB é obrigatório")).toBeInTheDocument();
    });

    it("flags mismatched password confirmation", async () => {
      const { user } = renderRegisterPage();
      await goToStudentForm(user);

      await fillCommonFields(user, { confirmPassword: "Outra@123" });
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("As senhas não correspondem"),
      ).toBeInTheDocument();
    });

    it("flags a password that doesn't meet the strength rules", async () => {
      const { user } = renderRegisterPage();
      await goToStudentForm(user);

      await fillCommonFields(user, { password: "abc", confirmPassword: "abc" });
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("Senha deve ter no mínimo 8 caracteres"),
      ).toBeInTheDocument();
    });
  });

  describe("submission", () => {
    it("sends the expected payload for a student and redirects to /dashboard", async () => {
      let capturedBody: unknown;
      server.use(
        http.post(REGISTER_URL, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            { token: "test-token", user: makeUser() },
            { status: 201 },
          );
        }),
      );

      const { user } = renderRegisterPage();
      await goToStudentForm(user);
      await fillCommonFields(user);
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("Bem-vindo ao painel"),
      ).toBeInTheDocument();

      expect(capturedBody).toMatchObject({
        fullName: "Jéssica Pereira da Silva",
        email: "jessica@ufal.br",
        userType: "STUDENT",
        course: "Ciência da Computação",
        registrationCode: "2023001122",
      });
      expect(capturedBody).not.toHaveProperty("cndb");
    });

    it("sends the CNDB field for a teacher", async () => {
      let capturedBody: unknown;
      server.use(
        http.post(REGISTER_URL, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            { token: "test-token", user: makeUser() },
            { status: 201 },
          );
        }),
      );

      const { user } = renderRegisterPage();
      await goToTeacherForm(user);
      await fillCommonFields(user, {
        name: "Eduardo Rocha",
        email: "eduardo@ufal.br",
      });
      await user.type(
        screen.getByPlaceholderText("Ex.: Número da carteira docente"),
        "CNDB-998877",
      );
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("Bem-vindo ao painel"),
      ).toBeInTheDocument();

      expect(capturedBody).toMatchObject({
        userType: "TEACHER",
        cndb: "CNDB-998877",
      });
    });

    it("shows the server error message and does not navigate away on failure", async () => {
      server.use(
        http.post(REGISTER_URL, () =>
          HttpResponse.json(
            { message: "E-mail já cadastrado" },
            { status: 409 },
          ),
        ),
      );

      const { user } = renderRegisterPage();
      await goToStudentForm(user);
      await fillCommonFields(user);
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("E-mail já cadastrado"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Bem-vindo ao painel")).not.toBeInTheDocument();
    });

    it("disables the submit button while the request is in flight", async () => {
      server.use(
        http.post(REGISTER_URL, async () => {
          await delay(50);
          return HttpResponse.json(
            { token: "test-token", user: makeUser() },
            { status: 201 },
          );
        }),
      );

      const { user } = renderRegisterPage();
      await goToStudentForm(user);
      await fillCommonFields(user);
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByRole("button", { name: "Carregando..." }),
      ).toBeDisabled();

      expect(
        await screen.findByText("Bem-vindo ao painel"),
      ).toBeInTheDocument();
    });
  });
});
