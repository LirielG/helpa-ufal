import { describe, it, expect, vi } from "vitest";
import { Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@/test/render";
import { API, delay, http, HttpResponse, server } from "@/test/http";
import { signIn } from "@/test/auth";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { ReportActionModal } from "../ReportActionModal";

const ACTION_ID = "act-report";
const REPORTS_URL = `${API}/activities/${ACTION_ID}/reports`;

const REPORT_REASON_VALUES = [
  "SPAM",
  "INAPPROPRIATE_CONTENT",
  "MISINFORMATION",
  "DUPLICATE",
  "OTHER",
];

function reportCreated(body: Record<string, unknown>) {
  return HttpResponse.json(
    {
      id: "report-1",
      activityId: ACTION_ID,
      userId: "user-1",
      category: body.category,
      description: body.description ?? null,
      createdAt: "2026-01-01T12:00:00.000Z",
    },
    { status: 201 },
  );
}

/** Records every request body so tests can assert on what was sent and how often. */
function captureReports(
  respond: (
    body: Record<string, unknown>,
  ) => Response | Promise<Response> = reportCreated,
) {
  const bodies: Record<string, unknown>[] = [];

  server.use(
    http.post(REPORTS_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return respond(body);
    }),
  );

  return bodies;
}

/**
 * The modal moves focus inside itself on the next animation frame; waiting for
 * that keeps it from pulling focus away while a test is typing.
 */
async function renderModal(props: { onReported?: () => void } = {}) {
  const view = render(
    <ReportActionModal
      open
      actionId={ACTION_ID}
      onClose={vi.fn()}
      onReported={props.onReported}
    />,
  );

  await waitFor(() =>
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    ),
  );

  return view;
}

const descriptionField = () =>
  screen.getByPlaceholderText(/Digite aqui o motivo/i);

const submitButton = () => screen.getByRole("button", { name: /Denunciar/ });

describe("ReportActionModal", () => {
  describe("reasons", () => {
    it("offers exactly the five ReportReason categories, with no placeholder labels", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");

      expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual(
        REPORT_REASON_VALUES,
      );
      expect(screen.queryByText(/Motivo \d/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Spam ou divulgação indevida" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Conteúdo inadequado" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Informação falsa ou enganosa" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Ação duplicada" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Outro motivo" }),
      ).toBeInTheDocument();
    });

    it("allows only one reason to be selected", async () => {
      const { user } = await renderModal();

      await user.click(screen.getByRole("radio", { name: "Ação duplicada" }));
      await user.click(screen.getByRole("radio", { name: "Outro motivo" }));

      expect(screen.getByRole("radio", { name: "Outro motivo" })).toBeChecked();
      expect(
        screen
          .getAllByRole("radio")
          .filter((radio) => (radio as HTMLInputElement).checked),
      ).toHaveLength(1);
    });

    it("keeps submit disabled until a reason is chosen", async () => {
      const { user } = await renderModal();

      expect(submitButton()).toBeDisabled();

      await user.click(screen.getByRole("radio", { name: "Ação duplicada" }));

      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  describe("description", () => {
    it("shows a character counter with the 500 limit", async () => {
      const { user } = await renderModal();

      expect(screen.getByText("0/500")).toBeInTheDocument();

      await user.type(descriptionField(), "abc");

      expect(screen.getByText("3/500")).toBeInTheDocument();
    });

    it("blocks a description over 500 characters before any request", async () => {
      const bodies = captureReports();
      const { user } = await renderModal();

      await user.click(screen.getByRole("radio", { name: "Outro motivo" }));
      await user.click(descriptionField());
      await user.paste("a".repeat(501));

      expect(
        await screen.findByText("Limite de 500 caracteres"),
      ).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();

      await user.click(submitButton());

      expect(bodies).toHaveLength(0);
    });
  });

  describe("submission", () => {
    it("sends only the category when the description is left blank", async () => {
      const bodies = captureReports();
      const { user } = await renderModal();

      await user.click(screen.getByRole("radio", { name: "Ação duplicada" }));
      await user.click(submitButton());

      await screen.findByText("Denúncia registrada");
      expect(bodies).toEqual([{ category: "DUPLICATE" }]);
    });

    it("sends the trimmed description alongside the category", async () => {
      const bodies = captureReports();
      const { user } = await renderModal();

      await user.click(
        screen.getByRole("radio", { name: "Informação falsa ou enganosa" }),
      );
      await user.type(descriptionField(), "  Data errada  ");
      await user.click(submitButton());

      await screen.findByText("Denúncia registrada");
      expect(bodies).toEqual([
        { category: "MISINFORMATION", description: "Data errada" },
      ]);
    });

    it("shows the confirmation only after the API answers 201", async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      captureReports(async (body) => {
        await gate;
        return reportCreated(body);
      });
      const onReported = vi.fn();
      const { user } = await renderModal({ onReported });

      await user.click(
        screen.getByRole("radio", { name: "Spam ou divulgação indevida" }),
      );
      await user.click(submitButton());

      expect(
        await screen.findByRole("button", { name: "Carregando..." }),
      ).toBeDisabled();
      expect(screen.queryByText("Denúncia registrada")).not.toBeInTheDocument();
      expect(onReported).not.toHaveBeenCalled();

      release();

      expect(
        await screen.findByText("Denúncia registrada"),
      ).toBeInTheDocument();
      expect(onReported).toHaveBeenCalledOnce();
    });

    it("registers a single report on a double click", async () => {
      const bodies = captureReports(async (body) => {
        await delay(50);
        return reportCreated(body);
      });
      const { user } = await renderModal();

      await user.click(screen.getByRole("radio", { name: "Ação duplicada" }));
      await user.dblClick(submitButton());

      await screen.findByText("Denúncia registrada");
      expect(bodies).toHaveLength(1);
    });
  });

  describe("errors", () => {
    it("tells the user the action was already reported on 409", async () => {
      captureReports(() =>
        HttpResponse.json(
          { message: "You have already reported this activity." },
          { status: 409 },
        ),
      );
      const onReported = vi.fn();
      const { user } = await renderModal({ onReported });

      await user.click(screen.getByRole("radio", { name: "Ação duplicada" }));
      await user.click(submitButton());

      expect(
        await screen.findByText("Você já denunciou esta ação."),
      ).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
      expect(screen.queryByText("Denúncia registrada")).not.toBeInTheDocument();
      expect(onReported).toHaveBeenCalledOnce();
    });

    it("shows a pt-BR message on a network error and lets the user retry", async () => {
      let attempts = 0;
      captureReports((body) => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : reportCreated(body);
      });
      const { user } = await renderModal();

      await user.click(screen.getByRole("radio", { name: "Outro motivo" }));
      await user.click(submitButton());

      expect(
        await screen.findByText(
          "Falha de comunicação com o servidor. Tente novamente.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Outro motivo" })).toBeChecked();

      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(
        await screen.findByText("Denúncia registrada"),
      ).toBeInTheDocument();
      expect(attempts).toBe(2);
    });

    it("sends the user to the login screen on 401 without showing an error", async () => {
      signIn();
      captureReports(() =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      );

      function SessionAwareModal() {
        useSessionExpiry();
        return (
          <ReportActionModal open actionId={ACTION_ID} onClose={vi.fn()} />
        );
      }

      const { user } = render(
        <Routes>
          <Route path="/activity/:id" element={<SessionAwareModal />} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>,
        { route: `/activity/${ACTION_ID}` },
      );

      const dialog = screen.getByRole("dialog");
      await waitFor(() =>
        expect(dialog).toContainElement(document.activeElement as HTMLElement),
      );
      await user.click(
        within(dialog).getByRole("radio", { name: "Ação duplicada" }),
      );
      await user.click(
        within(dialog).getByRole("button", { name: /Denunciar/ }),
      );

      expect(await screen.findByText("Tela de login")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
