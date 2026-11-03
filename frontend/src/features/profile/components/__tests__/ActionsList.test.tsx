import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@/test/render";
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

function page(items: UserActivityItem[], currentPage = 1, limit = 20) {
  return {
    items: items.slice((currentPage - 1) * limit, currentPage * limit),
    total: items.length,
    page: currentPage,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

function serveByFilter(
  lists: Partial<Record<UserActivityFilter, UserActivityItem[]>>,
) {
  server.use(
    http.get(`${API}/users/me/activities`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const filter = params.get("filter") as UserActivityFilter;

      return HttpResponse.json(
        page(
          lists[filter] ?? [],
          Number(params.get("page")),
          Number(params.get("limit")),
        ),
      );
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

function cardWithTitle(title: string) {
  // Cards have no named container for scoping their repeated controls.
  return screen
    .getByRole("heading", { name: title })
    .closest<HTMLDivElement>(".shadow-sm")!;
}

function makeItems(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeUserActivityItem({
      id: `paginated-${index + 1}`,
      title: `Ação ${index + 1}`,
    }),
  );
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

describe("ActionsList pagination", () => {
  it.each([
    ["success", "loading"],
    ["error", "loading"],
    ["empty", "loading"],
    ["success", "loaded"],
    ["error", "loaded"],
    ["empty", "loaded"],
  ] as const)(
    "ignores an abandoned page's %s response while the current list is %s",
    async (outcome, state) => {
      signIn();
      const items = makeItems(45);
      let releaseOld!: () => void;
      const oldGate = new Promise<void>((resolve) => {
        releaseOld = resolve;
      });
      let answeredOld!: () => void;
      const oldAnswered = new Promise<void>((resolve) => {
        answeredOld = resolve;
      });
      let releaseCurrent!: () => void;
      const currentGate = new Promise<void>((resolve) => {
        releaseCurrent = resolve;
      });
      const requests: string[] = [];

      server.use(
        http.get(`${API}/users/me/activities`, async ({ request }) => {
          const params = new URL(request.url).searchParams;
          const currentPage = Number(params.get("page"));
          const filter = params.get("filter");
          requests.push(`${filter}:${currentPage}`);

          if (filter === "enrolled" && currentPage === 2) {
            await oldGate;
            answeredOld();

            if (outcome === "error") return HttpResponse.error();

            return HttpResponse.json(page(outcome === "empty" ? [] : items, 2));
          }

          if (filter === "managed") {
            await currentGate;

            return HttpResponse.json(
              page([makeUserActivityItem({ title: "Atual" })]),
            );
          }

          return HttpResponse.json(page(items, currentPage));
        }),
      );

      const { user } = await openSubTab("enrolled");
      await screen.findByText("Ação 1");

      await user.click(screen.getByRole("button", { name: "Página 2" }));
      await waitFor(() => expect(requests).toContain("enrolled:2"));

      await user.click(
        screen.getByRole("button", { name: SUB_TAB_LABELS.managed }),
      );

      if (state === "loaded") {
        releaseCurrent();
        await screen.findByText("Atual");

        await user.click(
          screen.getByRole("button", { name: SUB_TAB_LABELS.enrolled }),
        );
        await screen.findByText("Ação 1");
      }

      await act(async () => {
        releaseOld();
        await oldAnswered;
        // Allow the HTTP client to parse the released response before checking the UI.
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Ação 21")).not.toBeInTheDocument();
      expect(Boolean(screen.queryByText("Carregando atividades..."))).toBe(
        state === "loading",
      );

      if (state === "loading") releaseCurrent();

      expect(
        await screen.findByText(state === "loading" ? "Atual" : "Ação 1"),
      ).toBeInTheDocument();
      expect(
        Boolean(screen.queryByRole("navigation", { name: "Paginação" })),
      ).toBe(state === "loaded");
      expect(
        Boolean(
          screen.queryByRole("button", { name: "Página 1", current: "page" }),
        ),
      ).toBe(state === "loaded");
      expect(requests).toEqual(
        state === "loading"
          ? ["enrolled:1", "enrolled:2", "managed:1"]
          : ["enrolled:1", "enrolled:2", "managed:1", "enrolled:1"],
      );
    },
  );

  it.each([0, 7, 20])("hides pagination for %i actions", async (count) => {
    signIn();
    serveByFilter({ enrolled: makeItems(count) });

    await openSubTab("enrolled");

    if (count) await screen.findByText("Ação 1");
    else
      await screen.findByText(
        "Você não está inscrito em nenhuma ação no momento.",
      );

    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("starts at page one every time a sub-tab is selected", async () => {
    signIn();
    const requests: string[] = [];

    server.use(
      http.get(`${API}/users/me/activities`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(`${params.get("filter")}:${params.get("page")}`);

        return HttpResponse.json(
          page(makeItems(45), Number(params.get("page"))),
        );
      }),
    );

    const { user } = await openSubTab("enrolled");
    await screen.findByText("Ação 1");

    await user.click(screen.getByRole("button", { name: "Página 2" }));
    await screen.findByText("Ação 21");

    await user.click(
      screen.getByRole("button", { name: SUB_TAB_LABELS.managed }),
    );
    await screen.findByText("Ação 1");

    await user.click(
      screen.getByRole("button", { name: SUB_TAB_LABELS.enrolled }),
    );

    expect(await screen.findByText("Ação 1")).toBeInTheDocument();
    expect(screen.queryByText("Ação 21")).not.toBeInTheDocument();
    expect(requests).toEqual([
      "enrolled:1",
      "enrolled:2",
      "managed:1",
      "enrolled:1",
    ]);
    expect(screen.getByRole("button", { name: "Página 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("replaces cards with loading while the next page is pending", async () => {
    signIn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const items = makeItems(45);

    server.use(
      http.get(`${API}/users/me/activities`, async ({ request }) => {
        const currentPage = Number(
          new URL(request.url).searchParams.get("page"),
        );

        if (currentPage === 2) await gate;

        return HttpResponse.json(page(items, currentPage));
      }),
    );

    const { user } = await openSubTab("enrolled");
    await screen.findByText("Ação 1");

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(screen.getByText("Carregando atividades...")).toBeInTheDocument();
    expect(screen.queryByText("Ação 1")).not.toBeInTheDocument();

    release();

    expect(await screen.findByText("Ação 21")).toBeInTheDocument();
  });

  it("keeps the intermediate page after cancelling one of its actions", async () => {
    signIn();
    const lists = { enrolled: makeItems(45) };
    serveByFilter(lists);

    server.use(
      http.delete(`${API}/activities/paginated-21/enroll`, () => {
        lists.enrolled = lists.enrolled.filter(
          (item) => item.id !== "paginated-21",
        );

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = await openSubTab("enrolled");
    await screen.findByText("Ação 1");

    await user.click(screen.getByRole("button", { name: "Página 2" }));
    await screen.findByText("Ação 21");

    await user.click(
      within(cardWithTitle("Ação 21")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Cancelar inscrição" }),
    );

    expect(await screen.findByText("Ação 41")).toBeInTheDocument();
    expect(screen.queryByText("Ação 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Ação 21")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("loads the previous page after deleting the last action on page three", async () => {
    signIn();
    const items = Array.from({ length: 41 }, (_, index) =>
      makeUserActivityItem({
        id: `delete-${index + 1}`,
        title: `Ação ${index + 1}`,
        enrollment: null,
      }),
    );
    const lists = { managed: items };
    const requests: number[] = [];

    server.use(
      http.get(`${API}/users/me/activities`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const currentPage = Number(params.get("page"));

        if (params.get("filter") !== "managed")
          return HttpResponse.json(page([]));

        requests.push(currentPage);

        return HttpResponse.json(page(lists.managed, currentPage));
      }),
      http.delete(`${API}/activities/delete-41`, () => {
        lists.managed = lists.managed.filter((item) => item.id !== "delete-41");

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = await openSubTab("managed");
    await screen.findByText("Ação 1");

    await user.click(screen.getByRole("button", { name: "Página 3" }));
    await screen.findByText("Ação 41");

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));
    await user.click(await screen.findByRole("button", { name: "Fechar" }));

    expect(await screen.findByText("Ação 40")).toBeInTheDocument();
    expect(screen.queryByText("Ação 41")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(requests).toEqual([1, 3, 3, 2]);
  });

  it("refills the current page after cancelling an enrollment", async () => {
    signIn();
    const items = Array.from({ length: 21 }, (_, index) =>
      makeUserActivityItem({
        id: `refill-${index + 1}`,
        title: `Ação ${index + 1}`,
      }),
    );
    const lists = { enrolled: items };
    serveByFilter(lists);

    server.use(
      http.delete(`${API}/activities/refill-1/enroll`, () => {
        lists.enrolled = lists.enrolled.filter(
          (item) => item.id !== "refill-1",
        );

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = await openSubTab("enrolled");
    await screen.findByRole("heading", { name: "Ação 1" });

    await user.click(
      within(cardWithTitle("Ação 1")).getByRole("button", { name: "Cancelar" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Cancelar inscrição" }),
    );

    expect(await screen.findByText("Ação 21")).toBeInTheDocument();
    expect(screen.queryByText("Ação 1")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(20);
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("retries the failed page and leaves sub-tabs available", async () => {
    signIn();
    const items = Array.from({ length: 45 }, (_, index) =>
      makeUserActivityItem({ title: `Ação ${index + 1}` }),
    );
    const requests: number[] = [];
    let shouldFail = true;

    server.use(
      http.get(`${API}/users/me/activities`, ({ request }) => {
        const currentPage = Number(
          new URL(request.url).searchParams.get("page"),
        );
        requests.push(currentPage);

        if (currentPage === 2 && shouldFail) return HttpResponse.error();

        return HttpResponse.json(page(items, currentPage));
      }),
    );

    const { user } = await openSubTab("enrolled");
    await screen.findByText("Ação 1");

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(
      await screen.findByText(
        "Não foi possível carregar as atividades. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: SUB_TAB_LABELS.managed }),
    ).toBeEnabled();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ação 21")).toBeInTheDocument();
    expect(requests).toEqual([1, 2, 2]);
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each(["enrolled", "completed", "managed"] as const)(
    "replaces the %s cards when navigating through 45 actions",
    async (filter) => {
      signIn();
      const items = Array.from({ length: 45 }, (_, index) =>
        makeUserActivityItem({ title: `Ação ${index + 1}` }),
      );
      serveByFilter({ [filter]: items });

      const { user } = await openSubTab(filter);

      expect(await screen.findByText("Ação 1")).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(20);
      expect(screen.queryByText("Ação 21")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Página 3" }));

      expect(await screen.findByText("Ação 45")).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(5);
      expect(screen.queryByText("Ação 1")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    },
  );
});

describe("ActionsList deletion", () => {
  function mockManagedActions() {
    const deleted = makeUserActivityItem({
      title: DELETED_TITLE,
      enrollment: null,
    });
    const kept = makeUserActivityItem({ title: KEPT_TITLE, enrollment: null });
    const lists = { managed: [deleted, kept] };
    serveByFilter(lists);

    return {
      deleted,
      remove: () => {
        lists.managed = lists.managed.filter((item) => item.id !== deleted.id);
      },
    };
  }

  async function openManagedTab() {
    const view = await openSubTab("managed");
    await screen.findByText(DELETED_TITLE);

    return view;
  }

  it("reloads the list after the deletion success modal is dismissed", async () => {
    signIn();
    const { deleted, remove } = mockManagedActions();

    server.use(
      http.delete(`${API}/activities/${deleted.id}`, () => {
        remove();

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = await openManagedTab();

    const deleteButton = within(cardWithTitle(DELETED_TITLE)).getByRole(
      "button",
      {
        name: "Excluir atividade",
      },
    );
    await user.click(deleteButton);
    await user.click(screen.getByRole("button", { name: "Sim" }));
    await user.click(await screen.findByRole("button", { name: "Fechar" }));

    expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument();
  });

  it("removes an action already deleted elsewhere without showing an error", async () => {
    signIn();
    const { deleted, remove } = mockManagedActions();

    server.use(
      http.delete(`${API}/activities/${deleted.id}`, () => {
        remove();

        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }),
    );

    const { user } = await openManagedTab();

    const deleteButton = within(cardWithTitle(DELETED_TITLE)).getByRole(
      "button",
      {
        name: "Excluir atividade",
      },
    );
    await user.click(deleteButton);
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(DELETED_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ActionsList cancellation from the enrolled card", () => {
  let enrolledItems: UserActivityItem[];

  function mockEnrolledActions() {
    const cancelled = makeUserActivityItem({ title: CANCELLED_TITLE });
    const kept = makeUserActivityItem({ title: KEPT_TITLE });
    enrolledItems = [cancelled, kept];
    serveByFilter({ enrolled: enrolledItems });

    return cancelled;
  }

  function answerCancellation(
    actionId: string,
    status: number,
    message?: string,
    code?: string,
  ) {
    server.use(
      http.delete(`${API}/activities/${actionId}/enroll`, () => {
        if (status === 0) return HttpResponse.error();

        if (status === 204 || status === 404) {
          const removed = enrolledItems.findIndex(
            (item) => item.id === actionId,
          );
          if (removed !== -1) enrolledItems.splice(removed, 1);
        }

        if (status === 204) return new HttpResponse(null, { status });

        return HttpResponse.json({ status, message, code }, { status });
      }),
    );
  }

  async function confirmCancellation() {
    const view = await openSubTab("enrolled");
    await screen.findByText(CANCELLED_TITLE);

    await view.user.click(
      within(cardWithTitle(CANCELLED_TITLE)).getByRole("button", {
        name: "Cancelar",
      }),
    );
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
    expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument();
  });

  it("removes the card when the enrollment was already cancelled elsewhere", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(
      cancelled.id,
      404,
      "Inscrição não encontrada.",
      "ENROLLMENT_NOT_FOUND",
    );

    await confirmCancellation();

    expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument();
  });

  it("removes the card when the action no longer exists", async () => {
    signIn();
    const cancelled = mockEnrolledActions();
    answerCancellation(
      cancelled.id,
      404,
      "Ação não encontrada.",
      "ACTIVITY_NOT_FOUND",
    );

    await confirmCancellation();

    expect(await screen.findByText(KEPT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(CANCELLED_TITLE)).not.toBeInTheDocument();
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
      "Não foi possível conectar ao servidor. Tente novamente.",
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

  it("downloads a certificate beyond the first hundred completed actions", async () => {
    signIn();
    const downloads: string[] = [];
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:certificate");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    let requestedCertificate: string | undefined;

    serveByFilter({ completed: [...makeItems(100), certifiedItem()] });
    server.use(
      http.get(`${API}/certificates/:id/file`, ({ params }) => {
        requestedCertificate = String(params.id);

        return new HttpResponse("%PDF-1.7", {
          headers: { "Content-Type": "application/pdf" },
        });
      }),
    );

    try {
      const { user } = await openSubTab("completed");
      await screen.findByText("Ação 1");

      await user.click(screen.getByRole("button", { name: "Página 6" }));
      await screen.findByText(CERTIFIED_TITLE);

      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
      expect(screen.getByText("18 horas homologadas")).toBeInTheDocument();

      await user.click(
        within(cardWithTitle(CERTIFIED_TITLE)).getByRole("button", {
          name: "Baixar certificado",
        }),
      );

      await waitFor(() =>
        expect(downloads).toEqual(["certificado-7KQ4MX9T2R.pdf"]),
      );
      expect(requestedCertificate).toBe("cert-1");
      await waitFor(() => expect(revokeObjectURL).toHaveBeenCalled());
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      click.mockRestore();
    }
  });

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
