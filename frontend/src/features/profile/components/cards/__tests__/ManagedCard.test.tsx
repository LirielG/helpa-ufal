import { describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router";
import { render, screen, waitFor, within } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import {
  makeAction,
  makeActionDetail,
  makeManagedActivity,
  makeManager,
} from "@/test/factories";
import { signIn } from "@/test/auth";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import type { ActionStatus } from "@/features/dashboard/types";
import type { UserActivity } from "../../../types";
import { ManagedCard } from "../ManagedCard";

const ACTION_ID = "act-managed";

const FORBIDDEN_MESSAGE =
  "Você não tem permissão para alterar o status desta ação.";
const NOT_FOUND_MESSAGE =
  "Esta ação não foi encontrada. Ela pode ter sido removida.";
const CONFLICT_MESSAGE =
  "O status desta ação foi alterado em outro lugar. Exibindo o status atual.";
const COMMUNICATION_MESSAGE =
  "Não foi possível alterar o status. Verifique sua conexão e tente novamente.";

function managed(activityStatus: ActionStatus): UserActivity {
  return makeManagedActivity({ id: ACTION_ID, activityStatus });
}

/** Mounts the session handler the way AppRoutes does, and shows the current path. */
function SessionProbe() {
  useSessionExpiry();
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderCard(activity: UserActivity, onEdit = vi.fn()) {
  return render(
    <>
      <SessionProbe />
      <ManagedCard activity={activity} onEdit={onEdit} />
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

function respondWithStatus(status: ActionStatus) {
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
