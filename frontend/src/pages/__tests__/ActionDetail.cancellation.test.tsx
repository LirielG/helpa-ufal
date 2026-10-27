import { describe, it, expect } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  HttpResponse,
  http,
  makeActionDetail,
  render,
  renderWithAuthPages,
  screen,
  server,
  signIn,
  submitLoginForm,
  submitStudentSignUpForm,
  waitFor,
} from "@/test";
import type { Activity } from "@/services/contracts/activity";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { ActionDetail } from "../ActionDetail";

const ACTION_ID = "act-cancellation";

/** Mounts the session handler the way AppRoutes does, so a 401 reaches /login. */
function SessionExpiry() {
  useSessionExpiry();
  return null;
}

function renderPage() {
  return render(
    <>
      <SessionExpiry />
      <Routes>
        <Route path="/activity/:id" element={<ActionDetail />} />
        <Route path="/login" element={<h1>Entrar</h1>} />
      </Routes>
    </>,
    { route: `/activity/${ACTION_ID}` },
  );
}

function renderPageWithAuthPages() {
  return renderWithAuthPages(
    "/activity/:id",
    <ActionDetail />,
    `/activity/${ACTION_ID}`,
  );
}

function enrolledAction(overrides: Partial<Activity> = {}): Activity {
  return makeActionDetail({
    id: ACTION_ID,
    slots: 20,
    availableSlots: 4,
    status: "OPEN",
    enrollmentStatus: "APPROVED",
    ...overrides,
  });
}

/** Answers GET /activities/:id with each snapshot in turn, repeating the last. */
function serveSnapshots(...snapshots: Activity[]) {
  let calls = 0;
  server.use(
    http.get(`${API}/activities/${ACTION_ID}`, () => {
      const snapshot = snapshots[Math.min(calls, snapshots.length - 1)];
      calls += 1;
      return HttpResponse.json(snapshot);
    }),
  );
  return () => calls;
}

function failCancellation(status: number, message?: string, code?: string) {
  server.use(
    http.delete(`${API}/activities/${ACTION_ID}/enroll`, () =>
      status === 0
        ? HttpResponse.error()
        : HttpResponse.json({ message, code }, { status }),
    ),
  );
}

function succeedCancellation() {
  server.use(
    http.delete(
      `${API}/activities/${ACTION_ID}/enroll`,
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
}

async function openCancellationModal(user: ReturnType<typeof render>["user"]) {
  await user.click(
    await screen.findByRole("button", { name: "Cancelar inscrição" }),
  );
  expect(
    screen.getByRole("heading", { name: "Cancelar inscrição" }),
  ).toBeInTheDocument();
}

function confirmCancellation(user: ReturnType<typeof render>["user"]) {
  // Once the modal is open, the page's own button is still on screen too;
  // the modal's comes last in the DOM.
  const buttons = screen.getAllByRole("button", { name: "Cancelar inscrição" });
  return user.click(buttons[buttons.length - 1]);
}

describe("ActionDetail enrollment states", () => {
  it("invites a visitor to sign in to enroll in an open action with slots", async () => {
    serveSnapshots(
      makeActionDetail({ id: ACTION_ID, status: "OPEN", availableSlots: 4 }),
    );
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Entrar para se inscrever" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(
      screen.queryByRole("button", { name: /Inscrever-se|Cancelar inscrição/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Inscrito")).not.toBeInTheDocument();
  });

  it("brings a visitor who signs in back to the same action, ready to enroll", async () => {
    serveSnapshots(
      makeActionDetail({ id: ACTION_ID, status: "OPEN", availableSlots: 4 }),
    );
    const { user } = renderPageWithAuthPages();

    await user.click(
      await screen.findByRole("button", { name: "Entrar para se inscrever" }),
    );
    await submitLoginForm(user);

    expect(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Entrar para se inscrever" }),
    ).not.toBeInTheDocument();
  });

  it("brings a visitor who signs up from Criar conta back to the same action", async () => {
    serveSnapshots(
      makeActionDetail({ id: ACTION_ID, status: "OPEN", availableSlots: 4 }),
    );
    const { user } = renderPageWithAuthPages();

    await user.click(await screen.findByRole("link", { name: "Criar conta" }));
    await submitStudentSignUpForm(user);
    await submitLoginForm(user);

    expect(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    ).toBeEnabled();
  });

  it("brings a visitor who switches from the login to the sign-up back to the same action", async () => {
    serveSnapshots(
      makeActionDetail({ id: ACTION_ID, status: "OPEN", availableSlots: 4 }),
    );
    const { user } = renderPageWithAuthPages();

    await user.click(
      await screen.findByRole("button", { name: "Entrar para se inscrever" }),
    );
    await user.click(screen.getByRole("link", { name: "Criar conta" }));
    await submitStudentSignUpForm(user);
    await submitLoginForm(user);

    expect(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    ).toBeEnabled();
  });

  it("shows Vagas esgotadas, without the sign-in invite, to a visitor of a full action", async () => {
    serveSnapshots(
      makeActionDetail({ id: ACTION_ID, status: "OPEN", availableSlots: 0 }),
    );
    renderPage();

    expect(
      await screen.findByRole("button", { name: /Vagas esgotadas/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Entrar para se inscrever" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Criar conta" }),
    ).not.toBeInTheDocument();
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "shows Inscrição indisponível, without the sign-in invite, to a visitor of a %s action",
    async (status) => {
      serveSnapshots(
        makeActionDetail({ id: ACTION_ID, status, availableSlots: 4 }),
      );
      renderPage();

      expect(
        await screen.findByRole("button", { name: /Inscrição indisponível/ }),
      ).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Entrar para se inscrever" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["APPROVED", "PENDING"] as const)(
    "shows Inscrito and Cancelar inscrição for a %s enrollment in an open action",
    async (enrollmentStatus) => {
      signIn();
      serveSnapshots(enrolledAction({ enrollmentStatus }));
      renderPage();

      expect(
        await screen.findByRole("button", { name: "Cancelar inscrição" }),
      ).toBeEnabled();
      expect(screen.getByText("Inscrito")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Inscrever-se/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("tells an enrolled user that cancellation is closed when the action is not open", async () => {
    signIn();
    serveSnapshots(enrolledAction({ status: "IN_PROGRESS" }));
    renderPage();

    expect(
      await screen.findByText("Cancelamento não está mais disponível"),
    ).toBeInTheDocument();
    expect(screen.getByText("Inscrito")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar inscrição" }),
    ).not.toBeInTheDocument();
  });

  it("shows Inscrição indisponível for a rejected enrollment", async () => {
    signIn();
    serveSnapshots(enrolledAction({ enrollmentStatus: "REJECTED" }));
    renderPage();

    expect(
      await screen.findByRole("button", { name: /Inscrição indisponível/ }),
    ).toBeDisabled();
  });

  it.each([null, "CANCELLED", undefined] as const)(
    "shows Inscrição indisponível when the action is not open (enrollmentStatus %s)",
    async (enrollmentStatus) => {
      signIn();
      serveSnapshots(enrolledAction({ enrollmentStatus, status: "COMPLETED" }));
      renderPage();

      expect(
        await screen.findByRole("button", { name: /Inscrição indisponível/ }),
      ).toBeDisabled();
    },
  );

  it("shows Vagas esgotadas when an open action has no slots left", async () => {
    signIn();
    serveSnapshots(
      enrolledAction({ enrollmentStatus: null, availableSlots: 0 }),
    );
    renderPage();

    expect(
      await screen.findByRole("button", { name: /Vagas esgotadas/ }),
    ).toBeDisabled();
  });

  it.each([null, "CANCELLED", undefined] as const)(
    "shows Inscrever-se when an open action has slots (enrollmentStatus %s)",
    async (enrollmentStatus) => {
      signIn();
      serveSnapshots(enrolledAction({ enrollmentStatus }));
      renderPage();

      expect(
        await screen.findByRole("button", { name: /Inscrever-se/ }),
      ).toBeEnabled();
    },
  );
});

describe("ActionDetail enrollment cancellation", () => {
  it("closes the modal without a request when the user keeps the enrollment", async () => {
    signIn();
    serveSnapshots(enrolledAction());
    let requests = 0;
    server.use(
      http.delete(`${API}/activities/${ACTION_ID}/enroll`, () => {
        requests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPage();

    await openCancellationModal(user);
    await user.click(screen.getByRole("button", { name: "Manter inscrição" }));

    expect(
      screen.queryByRole("heading", { name: "Cancelar inscrição" }),
    ).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("shows the toast and the refreshed slots after a 204", async () => {
    signIn();
    const calls = serveSnapshots(
      enrolledAction(),
      enrolledAction({ enrollmentStatus: "CANCELLED", availableSlots: 5 }),
    );
    succeedCancellation();
    const { user } = renderPage();

    expect(
      await screen.findByText("4 disponíveis / 20 no total"),
    ).toBeInTheDocument();
    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(await screen.findByText("Inscrição cancelada.")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    ).toBeEnabled();
    expect(screen.getByText("5 disponíveis / 20 no total")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cancelar inscrição" }),
    ).not.toBeInTheDocument();
    expect(calls()).toBe(2);
  });

  it.each([0, 500, 404])(
    "keeps the action after cancellation when refresh fails with %s",
    async (status) => {
      signIn();
      let calls = 0;
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () => {
          calls += 1;
          if (calls === 1) return HttpResponse.json(enrolledAction());
          return status === 0
            ? HttpResponse.error()
            : new HttpResponse(null, { status });
        }),
      );
      succeedCancellation();
      const { user } = renderPage();

      await openCancellationModal(user);
      await confirmCancellation(user);

      expect(
        await screen.findByText("Inscrição cancelada."),
      ).toBeInTheDocument();
      await waitFor(() => expect(calls).toBe(2));
      expect(
        screen.getByText("4 disponíveis / 20 no total"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancelar inscrição" }),
      ).toBeEnabled();
      expect(
        screen.queryByText("Ação não encontrada."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Cancelar inscrição" }),
      ).not.toBeInTheDocument();
    },
  );

  it("settles on the not-enrolled state without an error when the enrollment was already cancelled", async () => {
    signIn();
    serveSnapshots(
      enrolledAction(),
      enrolledAction({ enrollmentStatus: "CANCELLED", availableSlots: 5 }),
    );
    failCancellation(404, "Inscrição não encontrada.", "ENROLLMENT_NOT_FOUND");
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Inscrição cancelada.")).not.toBeInTheDocument();
  });

  it("moves the page to the error state when the action no longer exists", async () => {
    signIn();
    serveSnapshots(enrolledAction());
    failCancellation(404, "Ação não encontrada.", "ACTIVITY_NOT_FOUND");
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(
      await screen.findByText("Esta ação não existe mais."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cancelar inscrição" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Inscrito and explains the closed action on 409", async () => {
    signIn();
    serveSnapshots(enrolledAction(), enrolledAction({ status: "IN_PROGRESS" }));
    failCancellation(409, "Activity is not open for cancellation.");
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta ação não está mais aberta, não é possível cancelar a inscrição.",
    );
    expect(screen.getByText("Inscrito")).toBeInTheDocument();
  });

  it("stops offering the cancellation once a 409 reveals the action closed", async () => {
    signIn();
    serveSnapshots(enrolledAction(), enrolledAction({ status: "IN_PROGRESS" }));
    failCancellation(409, "Activity is not open for cancellation.");
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Manter inscrição" }));

    expect(
      await screen.findByText("Cancelamento não está mais disponível"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar inscrição" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the enrollment active and shows a pt-BR message on network error", async () => {
    signIn();
    serveSnapshots(enrolledAction());
    failCancellation(0);
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha de comunicação com o servidor. Tente novamente.",
    );
    expect(screen.getByText("Inscrito")).toBeInTheDocument();
  });

  it("goes to the login screen on 401", async () => {
    signIn();
    serveSnapshots(enrolledAction());
    failCancellation(401, "Token malformatted, expired or invalid.");
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
  });

  it("enrolls again through the normal flow after cancelling", async () => {
    signIn();
    serveSnapshots(
      enrolledAction(),
      enrolledAction({ enrollmentStatus: "CANCELLED", availableSlots: 5 }),
      enrolledAction(),
    );
    succeedCancellation();
    server.use(
      http.post(
        `${API}/activities/${ACTION_ID}/enroll`,
        () => new HttpResponse(null, { status: 201 }),
      ),
    );
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);
    await user.click(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    );
    await user.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(
      await screen.findByText("Oba! Você está dentro!"),
    ).toBeInTheDocument();

    expect(await screen.findByText("Inscrito")).toBeInTheDocument();
  });

  it("explains that a full action has no slots when enrolling again", async () => {
    signIn();
    serveSnapshots(
      enrolledAction(),
      enrolledAction({ enrollmentStatus: "CANCELLED", availableSlots: 1 }),
    );
    succeedCancellation();
    server.use(
      http.post(`${API}/activities/${ACTION_ID}/enroll`, () =>
        HttpResponse.json(
          {
            message: "No available slots for this activity.",
            code: "NO_AVAILABLE_SLOTS",
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderPage();

    await openCancellationModal(user);
    await confirmCancellation(user);
    await user.click(
      await screen.findByRole("button", { name: /Inscrever-se/ }),
    );
    await user.click(screen.getByRole("button", { name: /Confirmar/ }));

    expect(
      await screen.findByText("Esta ação não tem mais vagas disponíveis."),
    ).toBeInTheDocument();
  });
});
