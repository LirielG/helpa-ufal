import { describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router";
import { render, screen, waitFor, within } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import {
  makeAction,
  makeActionDetail,
  makeManagedActivity,
  makeManager,
  makeUserActivity,
} from "@/test/factories";
import { signIn } from "@/test/auth";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import type { ActivityStatus } from "@/services/contracts/activity";
import type { UserActivity } from "../../../types";
import { ManagedCard } from "../ManagedCard";
import { EnrolledCard } from "../EnrolledCard";

const ACTION_ID = "act-managed";

const FORBIDDEN_MESSAGE =
  "Você não tem permissão para alterar o status desta ação.";
const NOT_FOUND_MESSAGE =
  "Esta ação não foi encontrada. Ela pode ter sido removida.";
const CONFLICT_MESSAGE =
  "O status desta ação foi alterado em outro lugar. Exibindo o status atual.";
const RELOAD_FAILED_MESSAGE =
  "Não foi possível carregar o status atual. Recarregue a página.";
const COMMUNICATION_MESSAGE =
  "Não foi possível alterar o status. Verifique sua conexão e tente novamente.";

function managed(activityStatus: ActivityStatus): UserActivity {
  return makeManagedActivity({ id: ACTION_ID, activityStatus });
}

/** Mounts the session handler the way AppRoutes does, and shows the current path. */
function SessionProbe() {
  useSessionExpiry();
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderCard(
  activity: UserActivity,
  onEdit = vi.fn(),
  onManageEnrollments = vi.fn(),
  onDelete = vi.fn(),
) {
  return render(
    <>
      <SessionProbe />
      <ManagedCard
        activity={activity}
        onEdit={onEdit}
        onManageEnrollments={onManageEnrollments}
        onDelete={onDelete}
      />
    </>,
    { route: "/profile" },
  );
}

function statusSelect() {
  return screen.getByRole("combobox", { name: "Status" });
}

function optionLabels() {
  return within(statusSelect())
    .getAllByRole("option")
    .map((option) => option.textContent);
}

/** Answers every PATCH with `respond` and records each body it received. */
function recordPatches(
  respond: (body: unknown) => Response | Promise<Response>,
) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${API}/activities/${ACTION_ID}/status`, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return respond(body);
    }),
  );
  return bodies;
}

function recordDeletes(
  respond: () => Response | Promise<Response> = () =>
    new HttpResponse(null, { status: 204 }),
) {
  const requests: unknown[] = [];
  server.use(
    http.delete(`${API}/activities/${ACTION_ID}`, async () => {
      requests.push(true);
      return respond();
    }),
  );
  return requests;
}

function respondWithStatus(status: ActivityStatus) {
  return () => HttpResponse.json(makeAction({ id: ACTION_ID, status }));
}

function respondWithError(status: number, message: string) {
  return () => HttpResponse.json({ status, message }, { status });
}

describe("ManagedCard status control", () => {
  describe("options offered for each status", () => {
    it("offers starting and cancelling an OPEN action, but not completing it", () => {
      renderCard(managed("OPEN"));

      expect(statusSelect()).toBeEnabled();
      expect(statusSelect()).toHaveDisplayValue("Aberta");
      expect(optionLabels()).toEqual(["Aberta", "Em andamento", "Cancelada"]);
    });

    it("offers completing and cancelling an IN_PROGRESS action", () => {
      renderCard(managed("IN_PROGRESS"));

      expect(statusSelect()).toBeEnabled();
      expect(statusSelect()).toHaveDisplayValue("Em andamento");
      expect(optionLabels()).toEqual([
        "Em andamento",
        "Concluída",
        "Cancelada",
      ]);
    });

    it.each([
      ["COMPLETED", "Concluída"],
      ["CANCELLED", "Cancelada"],
    ] as const)(
      "shows a %s action's status without offering any transition",
      (status, label) => {
        renderCard(managed(status));

        expect(statusSelect()).toBeDisabled();
        expect(statusSelect()).toHaveDisplayValue(label);
        expect(optionLabels()).toEqual([label]);
      },
    );
  });

  describe("starting an action", () => {
    it("applies IN_PROGRESS right away and shows it without reloading", async () => {
      const bodies = recordPatches(respondWithStatus("IN_PROGRESS"));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(statusSelect()).toHaveDisplayValue("Em andamento"),
      );
      expect(optionLabels()).toEqual([
        "Em andamento",
        "Concluída",
        "Cancelada",
      ]);
      expect(bodies).toStrictEqual([{ status: "IN_PROGRESS" }]);
    });
  });

  describe("completing an action", () => {
    it("asks for confirmation, then shows the new status without reloading", async () => {
      const bodies = recordPatches(respondWithStatus("COMPLETED"));
      const { user } = renderCard(managed("IN_PROGRESS"));

      await user.selectOptions(statusSelect(), "Concluída");

      const dialog = screen.getByRole("dialog", { name: "Concluir ação" });
      expect(bodies).toHaveLength(0);

      await user.click(
        within(dialog).getByRole("button", { name: "Concluir ação" }),
      );

      await waitFor(() => expect(statusSelect()).toBeDisabled());
      expect(statusSelect()).toHaveDisplayValue("Concluída");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(bodies).toStrictEqual([{ status: "COMPLETED" }]);
    });

    it("sends nothing and keeps the current status when the user backs out", async () => {
      const bodies = recordPatches(respondWithStatus("COMPLETED"));
      const { user } = renderCard(managed("IN_PROGRESS"));

      await user.selectOptions(statusSelect(), "Concluída");
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Voltar",
        }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(statusSelect()).toHaveDisplayValue("Em andamento");
      expect(bodies).toHaveLength(0);
    });
  });

  describe("confirmation modal", () => {
    it.each([
      [
        "OPEN",
        "Cancelada",
        "Cancelar ação",
        "Manter ação",
        "A ação continuará visível, marcada como cancelada, e não poderá ser reaberta. Os inscritos não serão avisados automaticamente.",
      ],
      [
        "IN_PROGRESS",
        "Concluída",
        "Concluir ação",
        "Voltar",
        "Depois de concluída, a ação não poderá voltar a ficar em andamento.",
      ],
    ] as const)(
      "shows the %s → %s copy and buttons whose visible text matches their name",
      async (status, option, confirm, backOut, body) => {
        const { user } = renderCard(managed(status));

        await user.selectOptions(statusSelect(), option);

        const dialog = screen.getByRole("dialog", { name: confirm });
        expect(
          within(dialog).getByText(body, { exact: false }),
        ).toBeInTheDocument();
        // Voice control users say what they see; a button reading "Cancelar"
        // that keeps the action would do the opposite of what they asked.
        expect(
          within(dialog).getByRole("button", { name: confirm }),
        ).toHaveTextContent(new RegExp(`^${confirm}$`));
        expect(
          within(dialog).getByRole("button", { name: backOut }),
        ).toHaveTextContent(new RegExp(`^${backOut}$`));
      },
    );

    it("shows the workload only when the action has one", async () => {
      const { user } = renderCard(
        makeManagedActivity({
          id: ACTION_ID,
          activityStatus: "OPEN",
          workloadHours: undefined,
        }),
      );

      await user.selectOptions(statusSelect(), "Cancelada");

      expect(
        within(screen.getByRole("dialog")).queryByText(/horas/),
      ).not.toBeInTheDocument();
    });
  });

  describe("cancelling an action", () => {
    it("asks for confirmation in a modal titled 'Cancelar ação'", async () => {
      recordPatches(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Cancelada");

      const dialog = screen.getByRole("dialog", { name: "Cancelar ação" });
      // The enrollment cancellation modal (#181) uses this title; the two
      // must not be confused.
      expect(
        screen.queryByText("Confirmar cancelamento"),
      ).not.toBeInTheDocument();
      // The backend notifies nobody, so the copy must not promise it does.
      expect(
        within(dialog).getByText(/não serão avisados automaticamente/),
      ).toBeInTheDocument();
    });

    it("cancels after confirmation and shows the new status without reloading", async () => {
      const bodies = recordPatches(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Cancelada");
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );

      await waitFor(() => expect(statusSelect()).toBeDisabled());
      expect(statusSelect()).toHaveDisplayValue("Cancelada");
      expect(bodies).toStrictEqual([{ status: "CANCELLED" }]);
    });

    it("sends nothing and keeps the current status when the user backs out", async () => {
      const bodies = recordPatches(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Cancelada");
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Manter ação",
        }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(statusSelect()).toHaveDisplayValue("Aberta");
      expect(bodies).toHaveLength(0);
    });
  });

  it("lets a manager who is not the author change the status", async () => {
    signIn(makeManager());
    const bodies = recordPatches(respondWithStatus("IN_PROGRESS"));
    const { user } = renderCard(managed("OPEN"));

    await user.selectOptions(statusSelect(), "Em andamento");

    await waitFor(() =>
      expect(statusSelect()).toHaveDisplayValue("Em andamento"),
    );
    expect(bodies).toHaveLength(1);
  });

  describe("while the request is pending", () => {
    it("disables the control so a second change cannot fire another transition", async () => {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const bodies = recordPatches(async () => {
        await pending;
        return HttpResponse.json(
          makeAction({ id: ACTION_ID, status: "IN_PROGRESS" }),
        );
      });
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      await waitFor(() => expect(statusSelect()).toBeDisabled());

      release();

      await waitFor(() => expect(statusSelect()).toBeEnabled());
      expect(statusSelect()).toHaveDisplayValue("Em andamento");
      expect(bodies).toHaveLength(1);
    });

    it("sends a single request when the confirm button is double-clicked", async () => {
      const bodies = recordPatches(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Cancelada");
      await user.dblClick(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );

      await waitFor(() =>
        expect(statusSelect()).toHaveDisplayValue("Cancelada"),
      );
      expect(bodies).toHaveLength(1);
    });
  });

  describe("errors", () => {
    it("shows a permission message on 403 and keeps the previous status", async () => {
      recordPatches(
        respondWithError(
          403,
          "Forbidden. Requester is not the author or a manager.",
        ),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        FORBIDDEN_MESSAGE,
      );
      expect(statusSelect()).toHaveDisplayValue("Aberta");
    });

    it("shows a not-found message on 404 and stops offering transitions", async () => {
      recordPatches(respondWithError(404, "Activity not found."));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        NOT_FOUND_MESSAGE,
      );
      expect(statusSelect()).toBeDisabled();
    });

    it("reloads the real status on 409 so no stale option stays on screen", async () => {
      recordPatches(
        respondWithError(
          409,
          "Activity is already CANCELLED and cannot be transitioned.",
        ),
      );
      // Another tab cancelled the action in the meantime.
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () =>
          HttpResponse.json(
            makeActionDetail({ id: ACTION_ID, status: "CANCELLED" }),
          ),
        ),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        CONFLICT_MESSAGE,
      );
      await waitFor(() =>
        expect(statusSelect()).toHaveDisplayValue("Cancelada"),
      );
      expect(statusSelect()).toBeDisabled();
      expect(optionLabels()).toEqual(["Cancelada"]);
    });

    it("shows the not-found message when the reload after a 409 finds the action removed", async () => {
      recordPatches(
        respondWithError(
          409,
          "Activity is already CANCELLED and cannot be transitioned.",
        ),
      );
      // Another tab cancelled and then deleted the action.
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () =>
          HttpResponse.json(
            { status: 404, message: "Activity not found." },
            { status: 404 },
          ),
        ),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND_MESSAGE),
      );
      expect(statusSelect()).toBeDisabled();
    });

    it("stops offering transitions when the reload after a 409 fails", async () => {
      recordPatches(
        respondWithError(
          409,
          "Activity is already CANCELLED and cannot be transitioned.",
        ),
      );
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () => HttpResponse.error()),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          RELOAD_FAILED_MESSAGE,
        ),
      );
      // The displayed status is stale, so offering its transitions again
      // would only lead to another 409.
      expect(statusSelect()).toBeDisabled();
    });

    it("sends the user to the login screen on 401", async () => {
      recordPatches(respondWithError(401, "No token provided."));
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Em andamento");

      await waitFor(() =>
        expect(screen.getByTestId("location")).toHaveTextContent("/login"),
      );
    });

    it.each([
      ["a network failure", () => HttpResponse.error()],
      ["a 500", respondWithError(500, "Internal server error.")],
    ])(
      "shows a retryable message on %s without changing the displayed status",
      async (_case, respond) => {
        recordPatches(respond);
        const { user } = renderCard(managed("OPEN"));

        await user.selectOptions(statusSelect(), "Em andamento");

        expect(await screen.findByRole("alert")).toHaveTextContent(
          COMMUNICATION_MESSAGE,
        );
        expect(statusSelect()).toHaveDisplayValue("Aberta");
        expect(
          screen.getByRole("button", { name: "Tentar novamente" }),
        ).toBeInTheDocument();
      },
    );

    it("retries the same transition without asking for confirmation again", async () => {
      let attempts = 0;
      const bodies = recordPatches(() => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json(
              makeAction({ id: ACTION_ID, status: "CANCELLED" }),
            );
      });
      const { user } = renderCard(managed("OPEN"));

      await user.selectOptions(statusSelect(), "Cancelada");
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );
      await user.click(
        await screen.findByRole("button", { name: "Tentar novamente" }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(statusSelect()).toHaveDisplayValue("Cancelada"),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(bodies).toStrictEqual([
        { status: "CANCELLED" },
        { status: "CANCELLED" },
      ]);
    });
  });

  it("keeps the edit button working", async () => {
    const onEdit = vi.fn();
    const { user } = renderCard(managed("OPEN"), onEdit);

    await user.click(screen.getByRole("button", { name: "Editar atividade" }));

    expect(onEdit).toHaveBeenCalledWith(ACTION_ID);
  });
});

describe("ManagedCard deletion", () => {
  it("allows author to delete action, receiving 204 and triggering onDelete without reload", async () => {
    const onDelete = vi.fn();
    const requests = recordDeletes(
      () => new HttpResponse(null, { status: 204 }),
    );
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));

    expect(
      screen.getByRole("heading", { name: "Confirmar exclusão" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(ACTION_ID));
    expect(requests).toHaveLength(1);
    expect(screen.getByText("Sua ação foi excluída")).toBeInTheDocument();
  });

  it("does not send DELETE request when cancelling the confirmation modal", async () => {
    const onDelete = vi.fn();
    const requests = recordDeletes();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Não" }));

    expect(
      screen.queryByRole("heading", { name: "Confirmar exclusão" }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("includes confirmation copy distinguishing deletion from cancellation with no notification promise", async () => {
    const { user } = renderCard(managed("OPEN"));

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));

    expect(
      screen.getByText(/será completamente excluída e não terá como recorrer/i),
    ).toBeInTheDocument();
  });

  it("allows a manager who is not the creator to delete an action", async () => {
    signIn(makeManager());
    const onDelete = vi.fn();
    const requests = recordDeletes(
      () => new HttpResponse(null, { status: 204 }),
    );
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(ACTION_ID));
    expect(requests).toHaveLength(1);
  });

  it("shows pt-BR permission message on 403 response", async () => {
    recordDeletes(() =>
      HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
    );
    const onDelete = vi.fn();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(
      await screen.findByText("Você não tem permissão para excluir esta ação."),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("removes action from list quietly on 404 response without system error", async () => {
    recordDeletes(() =>
      HttpResponse.json({ message: "Not found" }, { status: 404 }),
    );
    const onDelete = vi.fn();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(ACTION_ID));
    expect(
      screen.queryByText(/erro de sistema|Internal server error/i),
    ).not.toBeInTheDocument();
  });

  it("redirects to login on 401 response", async () => {
    recordDeletes(() =>
      HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
    );
    const { user } = renderCard(managed("OPEN"));

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/login"),
    );
  });

  it("shows pt-BR error message on network failure and keeps action in list", async () => {
    recordDeletes(() => HttpResponse.error());
    const onDelete = vi.fn();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(
      await screen.findByText(
        "Não foi possível excluir a ação. Verifique sua conexão e tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("does not trigger two delete requests when double clicking confirm", async () => {
    const requests = recordDeletes(
      () => new HttpResponse(null, { status: 204 }),
    );
    const { user } = renderCard(managed("OPEN"));

    await user.click(screen.getByRole("button", { name: "Excluir atividade" }));
    await user.dblClick(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(requests).toHaveLength(1));
  });
});

describe("ManagedCard enrollments entry point", () => {
  it("opens the enrollment list without triggering edit", async () => {
    const onEdit = vi.fn();
    const onManageEnrollments = vi.fn();
    const { user } = renderCard(managed("OPEN"), onEdit, onManageEnrollments);

    await user.click(
      screen.getByRole("button", { name: "Gerenciar inscritos" }),
    );

    expect(onManageEnrollments).toHaveBeenCalledWith(ACTION_ID);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("keeps the edit button separate from the manage button", async () => {
    const onEdit = vi.fn();
    const onManageEnrollments = vi.fn();
    const { user } = renderCard(managed("OPEN"), onEdit, onManageEnrollments);

    await user.click(screen.getByRole("button", { name: "Editar atividade" }));

    expect(onEdit).toHaveBeenCalledWith(ACTION_ID);
    expect(onManageEnrollments).not.toHaveBeenCalled();
  });
});

describe("EnrolledCard", () => {
  it("does not render the manage enrollments button for actions the user did not create", () => {
    const activity = makeUserActivity({
      id: "act-2",
      title: "Plantio de Árvores",
      status: "enrolled",
    });

    render(<EnrolledCard activity={activity} />);

    expect(
      screen.queryByRole("button", { name: "Gerenciar inscritos" }),
    ).not.toBeInTheDocument();
  });
});
