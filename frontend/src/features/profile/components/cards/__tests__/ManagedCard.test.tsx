import { describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router";
import { render, screen, waitFor, within } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import {
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
import { toast } from "react-toastify";

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
  return makeManagedActivity({
    action: { id: ACTION_ID, status: activityStatus },
  });
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

/** Records PUT bodies to verify that confirmation sends each transition once. */
function recordPuts(respond: (body: unknown) => Response | Promise<Response>) {
  const bodies: unknown[] = [];
  server.use(
    http.put(`${API}/activities/${ACTION_ID}/status`, async ({ request }) => {
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
  return () => HttpResponse.json(makeActionDetail({ id: ACTION_ID, status }));
}

function respondWithError(status: number, message: string) {
  return () => HttpResponse.json({ status, message }, { status });
}

describe("ManagedCard status control", () => {
  describe("badge and action buttons for each status", () => {
    it("shows 'Inscrições Abertas' badge with 'Iniciar ação' and 'Cancelar ação' for OPEN", () => {
      renderCard(managed("OPEN"));

      expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Iniciar ação" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Cancelar ação" }),
      ).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Concluir ação" }),
      ).not.toBeInTheDocument();
    });

    it("shows 'Em Andamento' badge with 'Concluir ação' and 'Cancelar ação' for IN_PROGRESS", () => {
      renderCard(managed("IN_PROGRESS"));

      expect(screen.getByText("Em Andamento")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Concluir ação" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Cancelar ação" }),
      ).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Iniciar ação" }),
      ).not.toBeInTheDocument();
    });

    it.each([
      ["COMPLETED", "Finalizada"],
      ["CANCELLED", "Cancelada"],
    ] as const)(
      "shows only the '%s' badge without status action buttons",
      (status, label) => {
        renderCard(managed(status));

        expect(screen.getByText(label)).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Iniciar ação" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Concluir ação" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Cancelar ação" }),
        ).not.toBeInTheDocument();
      },
    );
  });

  describe("starting an action", () => {
    it("asks for confirmation, then updates the badge to 'Em Andamento' without reloading", async () => {
      const bodies = recordPuts(respondWithStatus("IN_PROGRESS"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));

      const dialog = screen.getByRole("dialog", { name: "Iniciar ação" });
      expect(bodies).toHaveLength(0);

      await user.click(
        within(dialog).getByRole("button", { name: "Iniciar ação" }),
      );

      expect(await screen.findByText("Em Andamento")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Iniciar ação" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Concluir ação" }),
      ).toBeEnabled();
      expect(bodies).toStrictEqual([{ status: "IN_PROGRESS" }]);
    });

    it("sends nothing and keeps 'Inscrições Abertas' when the user backs out", async () => {
      const bodies = recordPuts(respondWithStatus("IN_PROGRESS"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Voltar",
        }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
      expect(bodies).toHaveLength(0);
    });
  });

  describe("completing an action", () => {
    it("asks for confirmation, then updates the badge to 'Finalizada' without reloading", async () => {
      const bodies = recordPuts(respondWithStatus("COMPLETED"));
      const { user } = renderCard(managed("IN_PROGRESS"));

      await user.click(screen.getByRole("button", { name: "Concluir ação" }));

      const dialog = screen.getByRole("dialog", { name: "Concluir ação" });
      expect(bodies).toHaveLength(0);

      await user.click(
        within(dialog).getByRole("button", { name: "Concluir ação" }),
      );

      expect(await screen.findByText("Finalizada")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Concluir ação" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancelar ação" }),
      ).not.toBeInTheDocument();
      expect(bodies).toStrictEqual([{ status: "COMPLETED" }]);
    });

    it("sends nothing and keeps 'Em Andamento' when the user backs out", async () => {
      const bodies = recordPuts(respondWithStatus("COMPLETED"));
      const { user } = renderCard(managed("IN_PROGRESS"));

      await user.click(screen.getByRole("button", { name: "Concluir ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Voltar",
        }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Em Andamento")).toBeInTheDocument();
      expect(bodies).toHaveLength(0);
    });
  });

  describe("confirmation modal", () => {
    it.each([
      [
        "OPEN",
        "Iniciar ação",
        "Iniciar ação",
        "Voltar",
        "A ação passa a constar como em andamento. Novas inscrições deixam de ser aceitas.",
      ],
      [
        "OPEN",
        "Cancelar ação",
        "Cancelar ação",
        "Manter ação",
        "A ação continuará visível, marcada como cancelada, e não poderá ser reaberta. Os inscritos não serão avisados automaticamente.",
      ],
      [
        "IN_PROGRESS",
        "Concluir ação",
        "Concluir ação",
        "Voltar",
        "Depois de concluída, a ação não poderá voltar a ficar em andamento.",
      ],
    ] as const)(
      "shows the %s -> %s copy and buttons whose visible text matches their name",
      async (status, triggerButton, confirm, backOut, body) => {
        const { user } = renderCard(managed(status));

        await user.click(screen.getByRole("button", { name: triggerButton }));

        const dialog = screen.getByRole("dialog", { name: confirm });
        expect(
          within(dialog).getByText(body, { exact: false }),
        ).toBeInTheDocument();
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
          action: { id: ACTION_ID, status: "OPEN", details: null },
        }),
      );

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));

      expect(
        within(screen.getByRole("dialog")).queryByText(/horas/),
      ).not.toBeInTheDocument();
    });

    it("displays workload in singular inside the confirmation modal when action has 1 hour", async () => {
      const activity = makeManagedActivity({
        action: {
          id: ACTION_ID,
          status: "IN_PROGRESS",
          details: { ...makeActionDetail().details!, workloadHours: 1 },
        },
      });

      const { user } = renderCard(activity);

      await user.click(screen.getByRole("button", { name: "Concluir ação" }));

      const dialog = screen.getByRole("dialog", { name: "Concluir ação" });
      expect(within(dialog).getByText("1 hora")).toBeInTheDocument();
    });
  });

  describe("cancelling an action", () => {
    it("asks for confirmation in a modal titled 'Cancelar ação'", async () => {
      recordPuts(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));

      const dialog = screen.getByRole("dialog", { name: "Cancelar ação" });
      expect(
        screen.queryByText("Confirmar cancelamento"),
      ).not.toBeInTheDocument();
      expect(
        within(dialog).getByText(/não serão avisados automaticamente/),
      ).toBeInTheDocument();
    });

    it("cancels after confirmation and updates the badge to 'Cancelada' without reloading", async () => {
      const bodies = recordPuts(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );

      expect(await screen.findByText("Cancelada")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Iniciar ação" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancelar ação" }),
      ).not.toBeInTheDocument();
      expect(bodies).toStrictEqual([{ status: "CANCELLED" }]);
    });

    it("sends nothing and keeps the current status when the user backs out", async () => {
      const bodies = recordPuts(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Manter ação",
        }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
      expect(bodies).toHaveLength(0);
    });
  });

  it("lets a manager who is not the author change the status", async () => {
    signIn(makeManager());
    const bodies = recordPuts(respondWithStatus("IN_PROGRESS"));
    const { user } = renderCard(managed("OPEN"));

    await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Iniciar ação",
      }),
    );

    expect(await screen.findByText("Em Andamento")).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  describe("while the request is pending", () => {
    it("disables the status buttons so a second change cannot fire another transition", async () => {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const bodies = recordPuts(async () => {
        await pending;
        return HttpResponse.json(
          makeActionDetail({ id: ACTION_ID, status: "IN_PROGRESS" }),
        );
      });
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Iniciar ação" }),
        ).toBeDisabled(),
      );
      expect(
        screen.getByRole("button", { name: "Cancelar ação" }),
      ).toBeDisabled();

      release();

      expect(await screen.findByText("Em Andamento")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Concluir ação" }),
      ).toBeEnabled();
      expect(bodies).toHaveLength(1);
    });

    it("sends a single request when the confirm button is double-clicked", async () => {
      const bodies = recordPuts(respondWithStatus("CANCELLED"));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));
      await user.dblClick(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );

      expect(await screen.findByText("Cancelada")).toBeInTheDocument();
      expect(bodies).toHaveLength(1);
    });
  });

  describe("errors", () => {
    it("shows a permission message on 403 and keeps the previous status", async () => {
      recordPuts(
        respondWithError(
          403,
          "Forbidden. Requester is not the author or a manager.",
        ),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        FORBIDDEN_MESSAGE,
      );
      expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
    });

    it("shows a not-found message on 404 and disables status transitions", async () => {
      recordPuts(respondWithError(404, "Activity not found."));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        NOT_FOUND_MESSAGE,
      );
      expect(
        screen.getByRole("button", { name: "Iniciar ação" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Cancelar ação" }),
      ).toBeDisabled();
    });

    it("reloads the real status on 409 so no stale option stays on screen", async () => {
      recordPuts(
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

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        CONFLICT_MESSAGE,
      );
      expect(await screen.findByText("Cancelada")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Iniciar ação" }),
      ).not.toBeInTheDocument();
    });

    it("shows the not-found message when the reload after a 409 finds the action removed", async () => {
      recordPuts(
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

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND_MESSAGE),
      );
      expect(
        screen.getByRole("button", { name: "Iniciar ação" }),
      ).toBeDisabled();
    });

    it("disables status transitions when the reload after a 409 fails", async () => {
      recordPuts(
        respondWithError(
          409,
          "Activity is already CANCELLED and cannot be transitioned.",
        ),
      );
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () => HttpResponse.error()),
      );
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          RELOAD_FAILED_MESSAGE,
        ),
      );
      expect(
        screen.getByRole("button", { name: "Iniciar ação" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Cancelar ação" }),
      ).toBeDisabled();
    });

    it("sends the user to the login screen on 401", async () => {
      recordPuts(respondWithError(401, "No token provided."));
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Iniciar ação",
        }),
      );

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
        recordPuts(respond);
        const { user } = renderCard(managed("OPEN"));

        await user.click(screen.getByRole("button", { name: "Iniciar ação" }));
        await user.click(
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Iniciar ação",
          }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
          COMMUNICATION_MESSAGE,
        );
        expect(screen.getByText("Inscrições Abertas")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Tentar novamente" }),
        ).toBeInTheDocument();
      },
    );

    it("retries the same transition without asking for confirmation again", async () => {
      let attempts = 0;
      const bodies = recordPuts(() => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json(
              makeActionDetail({ id: ACTION_ID, status: "CANCELLED" }),
            );
      });
      const { user } = renderCard(managed("OPEN"));

      await user.click(screen.getByRole("button", { name: "Cancelar ação" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar ação",
        }),
      );
      await user.click(
        await screen.findByRole("button", { name: "Tentar novamente" }),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByText("Cancelada")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(onEdit).toHaveBeenCalledWith(ACTION_ID);
  });
});

describe("ManagedCard deletion", () => {
  it("closes the modal, removes the card and shows a toast after a 204 without a second modal", async () => {
    const onDelete = vi.fn();
    const toastSuccess = vi.spyOn(toast, "success");
    const requests = recordDeletes(
      () => new HttpResponse(null, { status: 204 }),
    );
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(
      screen.getByRole("heading", { name: "Confirmar exclusão" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(ACTION_ID));
    expect(requests).toHaveLength(1);
    expect(toastSuccess).toHaveBeenCalledWith("Ação excluída.");
    expect(
      screen.queryByRole("heading", { name: "Confirmar exclusão" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Sua ação foi excluída")).not.toBeInTheDocument();

    toastSuccess.mockRestore();
  });

  it("does not send DELETE request when cancelling the confirmation modal", async () => {
    const onDelete = vi.fn();
    const requests = recordDeletes();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Não" }));

    expect(
      screen.queryByRole("heading", { name: "Confirmar exclusão" }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("includes confirmation copy distinguishing deletion from cancellation with no notification promise", async () => {
    const { user } = renderCard(managed("OPEN"));

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(
      screen.getByText(/será completamente excluída e não terá como recorrer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Excluir não é o mesmo que cancelar/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/notifica|avisad/i)).not.toBeInTheDocument();
  });

  it("shows pt-BR permission message on 403 response", async () => {
    recordDeletes(() =>
      HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
    );
    const onDelete = vi.fn();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
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

    await user.click(screen.getByRole("button", { name: "Excluir" }));
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

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/login"),
    );
  });

  it("shows pt-BR error message on network failure and keeps action in list", async () => {
    recordDeletes(() => HttpResponse.error());
    const onDelete = vi.fn();
    const { user } = renderCard(managed("OPEN"), vi.fn(), vi.fn(), onDelete);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
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

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.dblClick(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(requests).toHaveLength(1));
  });
});

describe("ManagedCard action buttons", () => {
  it("renders Editar, Inscritos and Excluir in order with danger styling only on Excluir", () => {
    renderCard(managed("OPEN"));

    const editButton = screen.getByRole("button", { name: "Editar" });
    const enrollmentsButton = screen.getByRole("button", { name: "Inscritos" });
    const deleteButton = screen.getByRole("button", { name: "Excluir" });

    expect(
      editButton.compareDocumentPosition(enrollmentsButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      enrollmentsButton.compareDocumentPosition(deleteButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(deleteButton).toHaveClass("bg-red-800");
    expect(editButton).not.toHaveClass("bg-red-800");
    expect(enrollmentsButton).not.toHaveClass("bg-red-800");
  });

  it("opens the enrollment list without triggering edit", async () => {
    const onEdit = vi.fn();
    const onManageEnrollments = vi.fn();
    const { user } = renderCard(managed("OPEN"), onEdit, onManageEnrollments);

    await user.click(screen.getByRole("button", { name: "Inscritos" }));

    expect(onManageEnrollments).toHaveBeenCalledWith(ACTION_ID);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("keeps the edit button separate from the manage button", async () => {
    const onEdit = vi.fn();
    const onManageEnrollments = vi.fn();
    const { user } = renderCard(managed("OPEN"), onEdit, onManageEnrollments);

    await user.click(screen.getByRole("button", { name: "Editar" }));

    expect(onEdit).toHaveBeenCalledWith(ACTION_ID);
    expect(onManageEnrollments).not.toHaveBeenCalled();
  });
});

describe("EnrolledCard", () => {
  it("does not render the manage enrollments button for actions the user did not create", () => {
    const activity = makeUserActivity({
      action: { id: "act-2", title: "Plantio de Árvores" },
    });

    render(<EnrolledCard activity={activity} onCancelled={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Inscritos" }),
    ).not.toBeInTheDocument();
  });

  it("renders 'Cancelar inscrição' button for open actions and opens confirmation modal on click", async () => {
    const activity = makeUserActivity({
      action: { id: "act-2", title: "Plantio de Árvores", status: "OPEN" },
    });

    const { user } = render(
      <EnrolledCard activity={activity} onCancelled={vi.fn()} />,
    );

    const cancelButton = screen.getByRole("button", {
      name: "Cancelar inscrição",
    });
    expect(cancelButton).toBeInTheDocument();

    await user.click(cancelButton);

    expect(
      screen.getByRole("dialog", { name: "Cancelar inscrição" }),
    ).toBeInTheDocument();
  });

  it("styles 'Cancelar inscrição' like the managed card's 'Cancelar ação', not like 'Excluir'", () => {
    render(
      <>
        <EnrolledCard
          activity={makeUserActivity({ action: { status: "OPEN" } })}
          onCancelled={vi.fn()}
        />
        <ManagedCard
          activity={managed("OPEN")}
          onEdit={vi.fn()}
          onManageEnrollments={vi.fn()}
          onDelete={vi.fn()}
        />
      </>,
    );

    const cancelEnrollment = screen.getByRole("button", {
      name: "Cancelar inscrição",
    });
    const cancelAction = screen.getByRole("button", { name: "Cancelar ação" });

    for (const token of cancelAction.className.split(/\s+/).filter(Boolean)) {
      expect(cancelEnrollment).toHaveClass(token);
    }
    expect(cancelEnrollment).toHaveClass("bg-gray-200", "text-sm");
    expect(cancelEnrollment).not.toHaveClass("bg-red-600", "bg-red-800");
  });

  it("renders the title as a link to /activity/:id with stretched link covering the card", () => {
    const activity = makeUserActivity({
      action: { id: "act-2", title: "Plantio de Árvores" },
    });

    render(<EnrolledCard activity={activity} onCancelled={vi.fn()} />);

    const titleLink = screen.getByRole("link", { name: "Plantio de Árvores" });
    expect(titleLink).toHaveAttribute("href", "/activity/act-2");
    expect(titleLink).toHaveClass("after:absolute", "after:inset-0");
  });

  it("renders 'Ver detalhes' button without icon as a link to /activity/:id", () => {
    const activity = makeUserActivity({
      action: { id: "act-2", title: "Plantio de Árvores" },
    });

    render(<EnrolledCard activity={activity} onCancelled={vi.fn()} />);

    const detailsLink = screen.getByRole("link", { name: "Ver detalhes" });
    expect(detailsLink).toHaveAttribute("href", "/activity/act-2");
    expect(detailsLink).toHaveTextContent("Ver detalhes");
    expect(detailsLink.querySelector("svg")).toBeNull();
  });
});
