import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import type { UserEvent } from "@testing-library/user-event";
import {
  act,
  API,
  HttpResponse,
  http,
  render,
  screen,
  server,
  signIn,
  waitFor,
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

/** Answers every profile read with the signed-in user plus the overrides. */
function serveProfile(overrides: Partial<UserProfile> = {}) {
  server.use(
    http.get(`${API}/users/me`, () => HttpResponse.json(profileOf(overrides))),
  );
}

function findNameField() {
  return screen.findByLabelText("Nome completo");
}

function getSaveButton() {
  return screen.getByRole("button", { name: "Salvar Alterações" });
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
  await user.type(screen.getByLabelText("Confirmação da senha"), confirmation);
}

describe("Profile — personal data", () => {
  describe("fields", () => {
    it("shows e-mail and profile type as read-only", async () => {
      const signedIn = signIn({ userType: "TEACHER" });
      renderProfile();

      await findNameField();

      expect(screen.getByLabelText("Email")).toBeDisabled();
      expect(screen.getByLabelText("Email")).toHaveValue(signedIn.email);
      expect(screen.getByLabelText("Tipo de conta")).toBeDisabled();
      expect(screen.getByLabelText("Tipo de conta")).toHaveValue("Docente");
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

    it("updates the form and the stored user without reloading or ending the session", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      spyOnUpdate();
      const { user } = renderProfile();

      await replaceName(user, "Mariana Costa");
      await user.click(getSaveButton());

      await screen.findByText("Perfil atualizado com sucesso.");
      expect(useAuthStore.getState().user?.fullName).toBe("Mariana Costa");
      // The sidebar shows the new name too, not only the form.
      const sidebar = screen.getByRole("complementary", {
        name: "Menu lateral do usuário",
      });
      expect(
        within(sidebar).getByRole("heading", { name: "Mariana Costa" }),
      ).toBeInTheDocument();

      expect(screen.getByLabelText("Nome completo")).toHaveValue(
        "Mariana Costa",
      );
      expect(screen.getAllByText("MC").length).toBeGreaterThan(0);
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

    it("keeps the save button disabled until something changes", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      const field = await findNameField();
      expect(getSaveButton()).toBeDisabled();

      await user.type(field, " Lima");
      expect(getSaveButton()).toBeEnabled();

      await user.clear(field);
      await user.type(field, "Joana Ribeiro");
      expect(getSaveButton()).toBeDisabled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("keeps the save button disabled when a field is only focused and left", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const { user } = renderProfile();

      const field = await findNameField();
      await user.click(field);
      await user.tab();
      await user.click(screen.getByLabelText("Senha atual"));
      await user.tab();

      expect(getSaveButton()).toBeDisabled();
    });

    it("keeps the button disabled when only the current password is filled, as a browser autofill would", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await findNameField();
      await user.type(screen.getByLabelText("Senha atual"), CURRENT_PASSWORD);

      expect(getSaveButton()).toBeDisabled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("saves only the name when the current password was filled by the browser", async () => {
      signIn({ fullName: "Joana Ribeiro" });
      const onUpdate = spyOnUpdate();
      const { user } = renderProfile();

      await findNameField();
      await user.type(screen.getByLabelText("Senha atual"), CURRENT_PASSWORD);
      await replaceName(user, "Joana Lima");
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Perfil atualizado com sucesso."),
      ).toBeInTheDocument();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        fullName: "Joana Lima",
      });
      expect(screen.queryByText("Informe a nova senha")).toBeNull();
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
      const confirmation = screen.getByLabelText("Confirmação da senha");
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
      expect(screen.getByLabelText("Confirmação da senha")).toHaveValue(
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

describe("Profile — layout", () => {
  it("shows the page title and the form, without a global summary", async () => {
    signIn();
    serveProfile({ totalWorkloadHours: 40 });
    renderProfile();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dados Pessoais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Editar Perfil" }),
    ).toBeInTheDocument();
    // The total contributed is shown by the sidebar, not repeated here.
    expect(
      screen.queryByRole("group", { name: "Total contribuído" }),
    ).toBeNull();
  });

  it("shows registration code and course as read-only", async () => {
    signIn();
    serveProfile();
    renderProfile();

    await findNameField();

    expect(screen.getByLabelText("Matrícula")).toBeDisabled();
    expect(screen.getByLabelText("Matrícula")).toHaveValue("2026000001");
    expect(screen.getByLabelText("Curso")).toBeDisabled();
    expect(screen.getByLabelText("Curso")).toHaveValue("Ciência da Computação");
  });

  it("has no sign-out button inside the form", async () => {
    signIn();
    renderProfile();

    await findNameField();
    const form = screen.getByRole("form", { name: "Editar Perfil" });

    expect(within(form).queryByRole("button", { name: /sair/i })).toBeNull();
  });

  it("sends only once when the save button is clicked repeatedly", async () => {
    signIn({ fullName: "Joana Ribeiro" });
    const onUpdate = spyOnUpdate();
    const { user } = renderProfile();

    await replaceName(user, "Joana Lima");
    await user.dblClick(getSaveButton());

    await screen.findByText("Perfil atualizado com sucesso.");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("keeps the save button disabled while the first save is pending, even when two submits go out together", async () => {
    signIn({ fullName: "Joana Ribeiro" });
    const onRequest = vi.fn();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(`${API}/users/me`, async ({ request }) => {
        onRequest(await request.json());
        await gate;
        return HttpResponse.json(profileOf({ fullName: "Joana Lima" }));
      }),
    );
    const { user } = renderProfile();

    await replaceName(user, "Joana Lima");
    const save = getSaveButton();

    const form = screen.getByRole("form", {
      name: "Editar Perfil",
    }) as HTMLFormElement;
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await waitFor(() => expect(onRequest).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();

    release();

    await screen.findByText("Perfil atualizado com sucesso.");
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});

describe("Profile — sidebar summary", () => {
  it("keeps the total the update returns after saving the name", async () => {
    signIn({ fullName: "Joana Ribeiro" });
    serveProfile({ totalWorkloadHours: 40 });
    spyOnUpdate((body) =>
      HttpResponse.json(
        profileOf({
          ...(body as Partial<UserProfile>),
          totalWorkloadHours: 41,
        }),
      ),
    );
    const { user } = renderProfile();

    const sidebar = await screen.findByRole("complementary", {
      name: "Menu lateral do usuário",
    });
    expect(await within(sidebar).findByText("40 horas")).toBeInTheDocument();

    await replaceName(user, "Joana Lima");
    await user.click(getSaveButton());

    await screen.findByText("Perfil atualizado com sucesso.");
    expect(await within(sidebar).findByText("41 horas")).toBeInTheDocument();
    expect(within(sidebar).queryByText("40 horas")).toBeNull();
  });
});
