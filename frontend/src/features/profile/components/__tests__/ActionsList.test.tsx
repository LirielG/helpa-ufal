import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeUserActivityItem } from "@/test/factories";
import { signIn } from "@/test/auth";
import type {
  UserActivityFilter,
  UserActivityItem,
} from "@/services/contracts/user";
import { ActionsList } from "../ActionsList";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";

const mockNavigate = vi.fn();

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const DELETED_TITLE = "Ação a ser excluída";
const KEPT_TITLE = "Ação que permanece";

const CANCELLED_TITLE = "Ação da qual saio";
const CLOSED_TITLE = "Ação já em andamento";

const SUB_TAB_LABELS: Record<UserActivityFilter, string> = {
  enrolled: "Atividades Inscritas",
  completed: "Atividades Concluídas",
  managed: "Atividades Gerenciadas",
};

function page(items: UserActivityItem[]) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 100,
    totalPages: 1,
  };
}

/** Answers GET /users/me/activities with the items of the requested filter. */
function serveByFilter(
  lists: Partial<Record<UserActivityFilter, UserActivityItem[]>>,
) {
  server.use(
    http.get(`${API}/users/me/activities`, ({ request }) => {
      const filter = new URL(request.url).searchParams.get(
        "filter",
      ) as UserActivityFilter;
      return HttpResponse.json(page(lists[filter] ?? []));
    }),
  );
}

async function openSubTab(filter: UserActivityFilter) {
  const view = render(<ActionsList />, { route: "/profile" });
  if (filter !== "enrolled") {
    await view.user.click(
      screen.getByRole("button", { name: SUB_TAB_LABELS[filter] }),
    );
  }
  return view;
}

describe("ActionsList sub-tabs", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });
  it("shows a different list of the signed-in user on each sub-tab", async () => {
    signIn();
    serveByFilter({
      enrolled: [makeUserActivityItem({ title: "Inscrita" })],
      completed: [
        makeUserActivityItem({ title: "Concluída", status: "COMPLETED" }),
      ],
      managed: [
        makeUserActivityItem({ title: "Gerenciada", enrollment: null }),
      ],
    });
    const { user } = render(<ActionsList />, { route: "/profile" });

    expect(await screen.findByText("Inscrita")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Atividades Concluídas" }),
    );
    expect(await screen.findByText("Concluída")).toBeInTheDocument();
    expect(screen.queryByText("Inscrita")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Atividades Gerenciadas" }),
    );
    expect(await screen.findByText("Gerenciada")).toBeInTheDocument();
    expect(screen.queryByText("Concluída")).not.toBeInTheDocument();
  });

  it("never shows the response of a sub-tab the user already left", async () => {
    signIn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let answeredSlow!: () => void;
    const slowAnswered = new Promise<void>(
      (resolve) => (answeredSlow = resolve),
    );
    server.use(
      http.get(`${API}/users/me/activities`, async ({ request }) => {
        const filter = new URL(request.url).searchParams.get("filter");
        if (filter === "enrolled") {
          await gate;
          answeredSlow();
          return HttpResponse.json(
            page([makeUserActivityItem({ title: "Lenta" })]),
          );
        }
        return HttpResponse.json(
          page([makeUserActivityItem({ title: "Rápida" })]),
        );
      }),
    );
    const { user } = render(<ActionsList />, { route: "/profile" });

    await user.click(
      screen.getByRole("button", { name: "Atividades Gerenciadas" }),
    );
    expect(await screen.findByText("Rápida")).toBeInTheDocument();

    release();
    await slowAnswered;
    // Lets the client parse the late response and the list react to it.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText("Lenta")).not.toBeInTheDocument();
    expect(screen.getByText("Rápida")).toBeInTheDocument();
  });

  it.each([
    [
      "enrolled",
      "Você não está inscrito em nenhuma ação no momento.",
      "Explorar ações",
    ],
    ["completed", "Você ainda não concluiu nenhuma ação.", "Explorar ações"],
    ["managed", "Você ainda não criou nenhuma ação.", "Criar uma ação"],
  ] as const)(
    "shows the empty state of the %s sub-tab",
    async (filter, text, buttonLabel) => {
      signIn();
      serveByFilter({});
      await openSubTab(filter);

      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: buttonLabel }),
      ).toBeInTheDocument();
    },
  );

  it("shows a pt-BR message when the list cannot be loaded", async () => {
    signIn();
    server.use(
      http.get(`${API}/users/me/activities`, () => HttpResponse.error()),
    );
    await openSubTab("enrolled");

    expect(
      await screen.findByText(
        "Não foi possível carregar as atividades. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();
  });

  it("navigates to /dashboard when clicking 'Explorar ações' on enrolled empty state", async () => {
    signIn();
    serveByFilter({});
    const { user } = await openSubTab("enrolled");

    const button = await screen.findByRole("button", {
      name: "Explorar ações",
    });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to /dashboard when clicking 'Explorar ações' on completed empty state", async () => {
    signIn();
    serveByFilter({});
    const { user } = await openSubTab("completed");

    const button = await screen.findByRole("button", {
      name: "Explorar ações",
    });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("opens register modal when clicking 'Criar uma ação' on managed empty state and reloads list after creation", async () => {
    signIn();
    serveByFilter({ managed: [] });
    const { user } = await openSubTab("managed");

    const button = await screen.findByRole("button", {
      name: "Criar uma ação",
    });
    await user.click(button);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);

    serveByFilter({
      managed: [
        makeUserActivityItem({ title: "Nova Ação Criada", enrollment: null }),
      ],
    });

    const callback = useActionRegisterStore.getState().onSuccessCallback;
    expect(callback).toBeDefined();
    callback?.();

    expect(await screen.findByText("Nova Ação Criada")).toBeInTheDocument();
  });
});

describe("ActionsList deletion", () => {
  function mockManagedActions() {
    const deleted = makeUserActivityItem({
      title: DELETED_TITLE,
      enrollment: null,
    });
    const kept = makeUserActivityItem({ title: KEPT_TITLE, enrollment: null });
    serveByFilter({ managed: [deleted, kept] });
    return deleted;
  }

  async function openManagedTab() {
    const view = await openSubTab("managed");
    await screen.findByText(DELETED_TITLE);
    return view;
  }

  it("removes the deleted action from the list without reloading", async () => {
    signIn();
    const deleted = mockManagedActions();
    server.use(
      http.delete(
        `${API}/activities/${deleted.id}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { user } = await openManagedTab();

    const [firstDelete] = screen.getAllByRole("button", {
      name: "Excluir atividade",
    });
    await user.click(firstDelete);
    await user.click(screen.getByRole("button", { name: "Sim" }));
    await user.click(await screen.findByRole("button", { name: "Fechar" }));

    expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument();
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
  });

  it("removes an action already deleted elsewhere without showing an error", async () => {
    signIn();
    const deleted = mockManagedActions();
    server.use(
      http.delete(`${API}/activities/${deleted.id}`, () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );
    const { user } = await openManagedTab();

    const [firstDelete] = screen.getAllByRole("button", {
      name: "Excluir atividade",
    });
    await user.click(firstDelete);
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() =>
      expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ActionsList cancellation from the enrolled card", () => {
  function mockEnrolledActions() {
    const cancelled = makeUserActivityItem({ title: CANCELLED_TITLE });
    const kept = makeUserActivityItem({ title: KEPT_TITLE });
    serveByFilter({ enrolled: [cancelled, kept] });
    return cancelled;
  }

  function answerCancellation(
    actionId: string,
    status: number,
    message?: string,
  ) {
    server.use(
      http.delete(`${API}/activities/${actionId}/enroll`, () => {
        if (status === 0) return HttpResponse.error();
        if (status === 204) return new HttpResponse(null, { status });
        return HttpResponse.json({ status, message }, { status });
      }),
    );
  }

  async function confirmCancellation() {
    const view = await openSubTab("enrolled");
    await screen.findByText(CANCELLED_TITLE);
    const [firstCancel] = screen.getAllByRole("button", { name: "Cancelar" });
    await view.user.click(firstCancel);
    await view.user.click(
      screen.getByRole("button", { name: "Cancelar inscrição" }),
    );
    return view;
  }

  it("offers cancelling only while the action is OPEN", async () => {
    signIn();
    serveByFilter({
      enrolled: [
        makeUserActivityItem({ title: KEPT_TITLE, status: "OPEN" }),
        makeUserActivityItem({ title: CLOSED_TITLE, status: "IN_PROGRESS" }),
      ],
    });
    await openSubTab("enrolled");
    await screen.findByText(CLOSED_TITLE);

    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
  });

  it("removes the card and confirms with a toast when the cancellation succeeds", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(cancelled.id, 204);

    await confirmCancellation();

    expect(await screen.findByText("Inscrição cancelada.")).toBeInTheDocument();
    expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument();
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
  });

  it("removes the card when the enrollment was already cancelled elsewhere", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(cancelled.id, 404, "Enrollment not found.");

    await confirmCancellation();

    await waitFor(() =>
      expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(KEPT_TITLE)).toBeInTheDocument();
  });

  it("removes the card when the action no longer exists", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(cancelled.id, 404, "Activity not found.");

    await confirmCancellation();

    await waitFor(() =>
      expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument(),
    );
  });

  it("keeps the card and explains in the modal when the action is no longer OPEN", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(cancelled.id, 409, "Activity is not open.");

    const { user } = await confirmCancellation();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta ação não está mais aberta, não é possível cancelar a inscrição.",
    );
    await user.click(screen.getByRole("button", { name: "Manter inscrição" }));

    expect(screen.getByText(CANCELLED_TITLE)).toBeInTheDocument();
    // The action left OPEN, so the card stops offering what the API refuses.
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
  });

  it("keeps the card and explains in the modal on a network failure", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(cancelled.id, 0);

    const { user } = await confirmCancellation();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha de comunicação com o servidor. Tente novamente.",
    );
    expect(
      screen.getByRole("button", { name: "Cancelar inscrição" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Manter inscrição" }));

    expect(screen.getByText(CANCELLED_TITLE)).toBeInTheDocument();
    // A transient failure leaves the action OPEN, so retrying stays available.
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(2);
  });
});

describe("ActionsList certificates", () => {
  const CERTIFIED_TITLE = "Ação com certificado";
  const PENDING_TITLE = "Ação sem homologação";

  function certifiedItem(): UserActivityItem {
    const item = makeUserActivityItem({
      title: CERTIFIED_TITLE,
      status: "COMPLETED",
      certificate: {
        id: "cert-1",
        validationCode: "7KQ4MX9T2R",
        issuedAt: "2026-03-18T12:00:00.000Z",
      },
    });
    return {
      ...item,
      enrollment: item.enrollment && {
        ...item.enrollment,
        attendanceConfirmed: true,
        confirmedWorkloadHours: 18,
      },
    };
  }

  it("shows the certificate the route returns only on the completed card that has one", async () => {
    signIn();
    serveByFilter({
      completed: [
        certifiedItem(),
        makeUserActivityItem({ title: PENDING_TITLE, status: "COMPLETED" }),
      ],
    });
    await openSubTab("completed");

    expect(await screen.findByText(CERTIFIED_TITLE)).toBeInTheDocument();
    expect(screen.getByText("18 horas homologadas")).toBeInTheDocument();
    expect(screen.getByText("7KQ4M-X9T2R")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Baixar certificado" }),
    ).toHaveLength(1);
    expect(screen.getByText(PENDING_TITLE)).toBeInTheDocument();
    expect(screen.getByText("20 horas")).toBeInTheDocument();
  });

  it.each(["enrolled", "managed"] as const)(
    "shows nothing about certificates on the %s sub-tab",
    async (filter) => {
      signIn();
      serveByFilter({
        [filter]: [makeUserActivityItem({ title: KEPT_TITLE })],
      });
      await openSubTab(filter);

      expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
      expect(screen.queryByText(/certificado/i)).not.toBeInTheDocument();
    },
  );
});
