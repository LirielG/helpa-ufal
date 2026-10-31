import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import type { UserEvent } from "@testing-library/user-event";
import {
  API,
  HttpResponse,
  http,
  render,
  screen,
  server,
  signIn,
  within,
} from "@/test";
import type { UserProfile } from "@/types/profile";
import { useAuthStore } from "@/stores/authStore";
import { GuestRoute } from "@/routes/GuestRoute";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { FULL_NAME_MAX_LENGTH } from "@/validators/limits";
import { Profile } from "../Profile";
import { Login } from "../Login";

const CURRENT_PASSWORD = "Senha@123";
const NEW_PASSWORD = "Nova@1234";

function profileOf(overrides: Partial<UserProfile> = {}): UserProfile {
  const user = useAuthStore.getState().user!;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    userType: user.userType,
    isManager: user.isManager,
    createdAt: user.createdAt,
    registrationCode: "2026000001",
    course: "Ciência da Computação",
    cndb: null,
    totalWorkloadHours: 0,
    ...overrides,
  };
}

/** Replaces the update handler with a spy over the request body. */
function spyOnUpdate(
  respond: (body: Record<string, unknown>) => Response = (body) =>
    HttpResponse.json(profileOf(body as Partial<UserProfile>)),
) {
  const onRequest = vi.fn();

  server.use(
    http.patch(`${API}/users/me`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      onRequest(body);
      return respond(body);
    }),
  );

  return onRequest;
}

function failUpdate(status: number, body: Record<string, unknown> = {}) {
  return spyOnUpdate(() => HttpResponse.json(body, { status }));
}

/**
 * Both screens sit behind the guards the app uses, so the sign-out after a
 * password change is observed with the redirects they would add.
 */
function renderProfile() {
  useAuthStore.setState({ isSessionVerified: true });

  return render(
    <Routes>
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
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
    </Routes>,
    { route: "/profile" },
  );
}

/** Counts the profile reads, answering each with the signed-in user. */
function countProfileReads() {
  let reads = 0;
  server.use(
    http.get(`${API}/users/me`, () => {
      reads += 1;
      return HttpResponse.json(profileOf());
    }),
  );
  return () => reads;
}

/** Answers every profile read with the given total of homologated hours. */
function serveTotalWorkloadHours(totalWorkloadHours: number) {
  server.use(
    http.get(`${API}/users/me`, () =>
      HttpResponse.json(profileOf({ totalWorkloadHours })),
    ),
  );
}

function findContributionCounter() {
  return screen.findByRole("group", { name: "Total contribuído" });
}

function findNameField() {
  return screen.findByLabelText("Nome completo");
}

function getSaveButton() {
  return screen.getByRole("button", { name: "Salvar alterações" });
}

async function replaceName(user: UserEvent, name: string) {
  const field = await findNameField();
  await user.clear(field);
  await user.click(field);
  await user.paste(name);
}

async function fillPasswordChange(
  user: UserEvent,
  {
    current = CURRENT_PASSWORD,
    next = NEW_PASSWORD,
    confirmation = next,
  }: { current?: string; next?: string; confirmation?: string } = {},
) {
  await findNameField();
  if (current) await user.type(screen.getByLabelText("Senha atual"), current);
  await user.type(screen.getByLabelText("Nova senha"), next);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
}

describe("Profile — personal data", () => {
  describe("fields", () => {
    it("shows e-mail and profile type as read-only", async () => {
      const signedIn = signIn({ userType: "TEACHER" });
      renderProfile();

      await findNameField();

      expect(screen.getByLabelText("Email")).toBeDisabled();
      expect(screen.getByLabelText("Email")).toHaveValue(signedIn.email);
      expect(screen.getByLabelText("Tipo de perfil")).toBeDisabled();
      expect(screen.getByLabelText("Tipo de perfil")).toHaveValue("Docente");
    });

    it("offers no profile photo change and shows the initials instead", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      renderProfile();

      await findNameField();

      expect(
        screen.queryByRole("button", { name: "Alterar foto de perfil" }),
      ).toBeNull();
      expect(screen.getAllByText("JR").length).toBeGreaterThan(0);
    });
  });

  describe("saving the name", () => {
    it("sends only the new name and shows the success message", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await replaceName(user, "Joana Ribeiro Lima");
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Perfil atualizado com sucesso."),
      ).toBeInTheDocument();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        fullName: "Joana Ribeiro Lima",
      });
    });

    it("updates the name shown in the rest of the app without reloading", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      spyOnUpdate();
      const { user } = renderProfile();

      await replaceName(user, "Mariana Costa");
      await user.click(getSaveButton());

      await screen.findByText("Perfil atualizado com sucesso.");
      expect(useAuthStore.getState().user?.fullName).toBe("Mariana Costa");
      
      const headings = screen.getAllByRole("heading", { name: "Mariana Costa" });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it("does not read the profile again after saving", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const reads = countProfileReads();
      spyOnUpdate();
      const { user } = renderProfile();

      await replaceName(user, "Joana Lima");
      await user.click(getSaveButton());

      await screen.findByText("Perfil atualizado com sucesso.");
      expect(reads()).toBe(1);
    });

    it("does not send a name the user left untouched", async () => {
      signIn({ fullName: "Joana Ribeiro " });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user);
      await user.click(getSaveButton());

      await screen.findByText(
        "Senha alterada. Entre novamente com a nova senha.",
      );
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });
    });

    it("makes no request when nothing changed", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await findNameField();
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Nenhuma alteração para salvar."),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("blocks a name over the length limit without calling the API", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await replaceName(user, "a".repeat(FULL_NAME_MAX_LENGTH + 1));
      await user.click(getSaveButton());

      expect(
        await screen.findByText("O nome deve ter no máximo 120 caracteres."),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("shows a validation error from the API on the name field, not in an alert", async () => {
      signIn();
      failUpdate(400, {
        status: 400,
        message: "Validation error.",
        errors: [
          {
            field: "fullName",
            message: "Too big: expected string to have <=120 characters",
          },
        ],
      });
      const { user } = renderProfile();

      await replaceName(user, "Nome Recusado");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "Informe um nome válido, com até 120 caracteres.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          "Não foi possível salvar o perfil. Tente novamente.",
        ),
      ).toBeNull();
    });

    it.each([0, 500])(
      "shows the connection error (%i) and keeps what was typed",
      async (status) => {
        signIn();
        server.use(
          http.patch(`${API}/users/me`, () =>
            status === 0
              ? HttpResponse.error()
              : new HttpResponse(null, { status }),
          ),
        );
        const { user } = renderProfile();

        await replaceName(user, "Nome Digitado");
        await user.click(getSaveButton());

        expect(
          await screen.findByText(
            "Não foi possível conectar ao servidor. Tente novamente.",
          ),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Nome completo")).toHaveValue(
          "Nome Digitado",
        );
      },
    );
  });

  describe("changing the password", () => {
    it("sends the current and new passwords, then asks to sign in again", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user);
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "Senha alterada. Entre novamente com a nova senha.",
        ),
      ).toBeInTheDocument();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("changes the password of a user whose saved name predates the length limit", async () => {
      signIn({ fullName: "a".repeat(FULL_NAME_MAX_LENGTH + 10) });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user);
      await user.click(getSaveButton());

      await screen.findByText(
        "Senha alterada. Entre novamente com a nova senha.",
      );
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });
    });

    it("reveals the current password apart from the new one and its confirmation", async () => {
      signIn();
      const { user } = renderProfile();

      await findNameField();
      const current = screen.getByLabelText("Senha atual");
      const next = screen.getByLabelText("Nova senha");
      const confirmation = screen.getByLabelText("Confirmar nova senha");
      const [currentToggle, nextToggle] = screen.getAllByRole("button", {
        name: "Mostrar senha",
      });

      await user.click(currentToggle);

      expect(current).toHaveAttribute("type", "text");
      expect(next).toHaveAttribute("type", "password");
      expect(confirmation).toHaveAttribute("type", "password");

      await user.click(nextToggle);

      expect(next).toHaveAttribute("type", "text");
      expect(confirmation).toHaveAttribute("type", "text");
      expect(current).toHaveAttribute("type", "text");

      await user.click(currentToggle);

      expect(current).toHaveAttribute("type", "password");
      expect(next).toHaveAttribute("type", "text");
    });

    it("shows a wrong current password on its field and keeps the form filled", async () => {
      signIn();
      failUpdate(403, {
        status: 403,
        message: "Current password is incorrect.",
      });
      const { user } = renderProfile();

      await fillPasswordChange(user, { current: "Errada@123" });
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Senha atual incorreta."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Senha atual")).toHaveValue("Errada@123");
      expect(screen.getByLabelText("Nova senha")).toHaveValue(NEW_PASSWORD);
      expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue(
        NEW_PASSWORD,
      );
    });

    it("shows a new password equal to the current one on its field", async () => {
      signIn();
      failUpdate(422, {
        status: 422,
        message: "New password must be different from the current password.",
      });
      const { user } = renderProfile();

      await fillPasswordChange(user);
      await user.click(getSaveButton());

      expect(
        await screen.findByText("A nova senha deve ser diferente da atual."),
      ).toBeInTheDocument();
    });

    it("blocks a new password outside the policy without calling the API", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user, { next: "fraca" });
      await user.click(getSaveButton());

      expect(
        await screen.findByText("A nova senha não atende aos requisitos."),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("blocks a confirmation that differs from the new password", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user, { confirmation: "Outra@1234" });
      await user.click(getSaveButton());

      expect(
        await screen.findByText("As senhas não correspondem"),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("asks for the current password when only the new one is filled", async () => {
      signIn();
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await fillPasswordChange(user, { current: "" });
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Informe a senha atual"),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});

describe("Profile — total contributed", () => {
  it("shows the total of homologated hours", async () => {
    signIn();
    serveTotalWorkloadHours(40);
    renderProfile();

    const counter = await findContributionCounter();

    expect(within(counter).getByText("40")).toBeInTheDocument();
    expect(within(counter).getByText("horas")).toBeInTheDocument();
  });

  it("shows a total of zero", async () => {
    signIn();
    serveTotalWorkloadHours(0);
    renderProfile();

    const counter = await findContributionCounter();

    expect(within(counter).getByText("0")).toBeInTheDocument();
    expect(within(counter).getByText("horas")).toBeInTheDocument();
  });

  it("uses the singular label for one hour", async () => {
    signIn();
    serveTotalWorkloadHours(1);
    renderProfile();

    const counter = await findContributionCounter();

    expect(within(counter).getByText("1")).toBeInTheDocument();
    expect(within(counter).getByText("hora")).toBeInTheDocument();
  });

  it("shows a three-digit total in full", async () => {
    signIn();
    serveTotalWorkloadHours(120);
    renderProfile();

    const counter = await findContributionCounter();

    expect(within(counter).getByText("120")).toBeInTheDocument();
  });

  it("keeps the total the update returns after saving the name", async () => {
    signIn({ fullName: "Joana Ribeiro" });
    serveTotalWorkloadHours(40);
    spyOnUpdate((body) =>
      HttpResponse.json(
        profileOf({
          ...(body as Partial<UserProfile>),
          totalWorkloadHours: 41,
        }),
      ),
    );
    const { user } = renderProfile();

    await replaceName(user, "Joana Ribeiro Lima");
    await user.click(getSaveButton());
    await screen.findByText("Perfil atualizado com sucesso.");

    const counter = await findContributionCounter();
    expect(within(counter).getByText("41")).toBeInTheDocument();
  });
});
