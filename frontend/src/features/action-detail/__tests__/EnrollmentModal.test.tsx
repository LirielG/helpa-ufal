import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@/test/render";
import { http, HttpResponse, server } from "@/test/http";
import { makeActionDetail } from "@/test/factories";
import { EnrollmentModal } from "../components/EnrollmentModal";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

function EnrollmentDialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Inscrever-se</button>
      {open && (
        <EnrollmentModal
          action={makeActionDetail()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe("EnrollmentModal", () => {
  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
  });

  describe("success enrollment (201)", () => {
    it("shows success message after post /activities/:id/enroll resolves", async () => {
      const action = makeActionDetail({ id: "act-123" });
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      server.use(
        http.post(
          `${API}/activities/act-123/enroll`,
          () => new HttpResponse(null, { status: 201 }),
        ),
      );

      const { user } = render(
        <EnrollmentModal
          action={action}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      expect(screen.getByText("Confirmar inscrição")).toBeInTheDocument();

      const confirmButton = screen.getByRole("button", { name: /Confirmar/i });
      await user.click(confirmButton);

      // Should call onSuccess callback
      expect(onSuccess).toHaveBeenCalledOnce();

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText("Oba! Você está dentro!")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("dialog", { name: "Oba! Você está dentro!" }),
      ).toHaveAttribute("aria-modal", "true");
    });

    it("shows loading state during request", async () => {
      const action = makeActionDetail({ id: "act-456" });
      server.use(
        http.post(`${API}/activities/act-456/enroll`, async () => {
          // Delay to observe loading state
          await new Promise((resolve) => setTimeout(resolve, 100));
          return new HttpResponse(null, { status: 201 });
        }),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      // Find and click the confirm button (button with SVG checkmark)
      const buttons = screen.getAllByRole("button");
      const confirmButton =
        buttons.find(
          (btn) =>
            !btn.hasAttribute("aria-label") &&
            !(btn as HTMLButtonElement).disabled &&
            btn.textContent?.includes("✓"),
        ) || screen.getByRole("button", { name: /Confirmar/i });

      await user.click(confirmButton);

      // Wait for loading state - button should show "Carregando..."
      await waitFor(() => {
        expect(screen.getByText("Carregando...")).toBeInTheDocument();
      });

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText("Oba! Você está dentro!")).toBeInTheDocument();
      });
    });
  });

  describe("409 Conflict errors", () => {
    it("displays pt-BR message for 'not open for enrollment'", async () => {
      const action = makeActionDetail({ id: "act-409-1" });
      server.use(
        http.post(`${API}/activities/act-409-1/enroll`, () =>
          HttpResponse.json(
            {
              message: "Activity is not open for enrollment.",
              code: "ACTIVITY_NOT_OPEN_FOR_ENROLLMENT",
            },
            { status: 409 },
          ),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("As inscrições para esta ação não estão abertas."),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /Tentar novamente/i }),
      ).toBeInTheDocument();
    });

    it("displays pt-BR message for 'already enrolled'", async () => {
      const action = makeActionDetail({ id: "act-409-2" });
      server.use(
        http.post(`${API}/activities/act-409-2/enroll`, () =>
          HttpResponse.json(
            {
              message: "User is already enrolled in this activity.",
              code: "ALREADY_ENROLLED",
            },
            { status: 409 },
          ),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Você já está inscrito nesta ação."),
        ).toBeInTheDocument();
      });
    });

    it("displays pt-BR message for 'no available slots'", async () => {
      const action = makeActionDetail({ id: "act-409-3" });
      server.use(
        http.post(`${API}/activities/act-409-3/enroll`, () =>
          HttpResponse.json(
            {
              message: "No available slots for this activity.",
              code: "NO_AVAILABLE_SLOTS",
            },
            { status: 409 },
          ),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Esta ação não tem mais vagas disponíveis."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("404 Not Found", () => {
    it("displays pt-BR message when activity is not found", async () => {
      const action = makeActionDetail({ id: "act-404" });
      server.use(
        http.post(`${API}/activities/act-404/enroll`, () =>
          HttpResponse.json(
            { message: "Activity not found." },
            { status: 404 },
          ),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/A ação não foi encontrada/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Network errors (status 0)", () => {
    it("displays communication error and provides retry option", async () => {
      const action = makeActionDetail({ id: "act-net" });
      server.use(
        http.post(`${API}/activities/act-net/enroll`, () =>
          HttpResponse.error(),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Falha de comunicação/)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", {
        name: /Tentar novamente/i,
      });
      expect(retryButton).toBeInTheDocument();

      // Clicking retry should return to confirm step
      await user.click(retryButton);
      expect(screen.getByText("Confirmar inscrição")).toBeInTheDocument();
    });

    it("enables retry after network error without locking button", async () => {
      const action = makeActionDetail({ id: "act-net2" });
      server.use(
        http.post(`${API}/activities/act-net2/enroll`, () =>
          HttpResponse.error(),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Falha de comunicação/)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", {
        name: /Tentar novamente/i,
      });
      expect(retryButton).not.toBeDisabled();
    });
  });

  describe("401 Unauthorized", () => {
    it("does not display error message for 401 (lets session middleware redirect)", async () => {
      const action = makeActionDetail({ id: "act-401" });
      server.use(
        http.post(`${API}/activities/act-401/enroll`, () =>
          HttpResponse.json({ message: "No token provided." }, { status: 401 }),
        ),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      // Verify that the error step is not shown
      // (The session middleware should handle the redirect)
      await waitFor(() => {
        // Should not show error message
        expect(
          screen.queryByText(/Erro|Failed|Error/i),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Generic non-ApiErrors", () => {
    it("displays generic pt-BR error message for non-ApiError exceptions", async () => {
      const action = makeActionDetail({ id: "act-generic-err" });
      server.use(
        http.post(`${API}/activities/act-generic-err/enroll`, () => {
          throw new Error("Raw JavaScript Error Message");
        }),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: /Confirmar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Erro ao realizar inscrição. Tente novamente."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Double-click prevention", () => {
    it("prevents multiple requests from double-clicking confirm button", async () => {
      const action = makeActionDetail({ id: "act-dblclick" });
      let requestCount = 0;

      server.use(
        http.post(`${API}/activities/act-dblclick/enroll`, async () => {
          requestCount += 1;
          // Simulate a slow request to allow double-click attempt
          await new Promise((resolve) => setTimeout(resolve, 200));
          return new HttpResponse(null, { status: 201 });
        }),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      const confirmButton = screen.getByRole("button", { name: /Confirmar/i });

      // Attempt double-click
      await user.click(confirmButton);
      await user.click(confirmButton);

      // Wait for requests to complete
      await waitFor(() => {
        expect(screen.getByText("Oba! Você está dentro!")).toBeInTheDocument();
      });

      // Verify only one request was made
      expect(requestCount).toBe(1);
    });

    it("disables confirm button during submission", async () => {
      const action = makeActionDetail({ id: "act-disable" });
      server.use(
        http.post(`${API}/activities/act-disable/enroll`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return new HttpResponse(null, { status: 201 });
        }),
      );

      const { user } = render(
        <EnrollmentModal action={action} onClose={vi.fn()} />,
      );

      const confirmButton = screen.getByRole("button", { name: /Confirmar/i });
      expect(confirmButton).not.toBeDisabled();

      await user.click(confirmButton);

      // Button should be disabled during request
      expect(confirmButton).toBeDisabled();

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText("Oba! Você está dentro!")).toBeInTheDocument();
      });
    });
  });

  describe("Modal interactions", () => {
    it("uses the latest close callback without moving focus on a parent render", async () => {
      const action = makeActionDetail();
      const previousClose = vi.fn();
      const currentClose = vi.fn();
      const { user, rerender } = render(
        <EnrollmentModal action={action} onClose={previousClose} />,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /✕ Cancelar/ }),
        ).toHaveFocus(),
      );
      await user.tab();
      const confirm = screen.getByRole("button", { name: /Confirmar/i });
      expect(confirm).toHaveFocus();

      rerender(<EnrollmentModal action={action} onClose={currentClose} />);
      await new Promise(requestAnimationFrame);

      expect(confirm).toHaveFocus();
      expect(document.body.style.overflow).toBe("hidden");
      await user.keyboard("{Escape}");
      expect(previousClose).not.toHaveBeenCalled();
      expect(currentClose).toHaveBeenCalledOnce();
    });

    it.each(["", "scroll"])(
      "moves focus inside on open and restores the opener and overflow %j on close",
      async (overflow) => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = overflow;
        const view = render(<EnrollmentDialogExample />);

        try {
          const opener = screen.getByRole("button", { name: "Inscrever-se" });
          await view.user.click(opener);

          expect(document.body.style.overflow).toBe("hidden");
          await waitFor(() =>
            expect(
              screen.getByRole("button", { name: /✕ Cancelar/ }),
            ).toHaveFocus(),
          );
          await view.user.keyboard("{Escape}");

          expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
          expect(opener).toHaveFocus();
          expect(document.body.style.overflow).toBe(overflow);
        } finally {
          view.unmount();
          document.body.style.overflow = previousOverflow;
        }
      },
    );

    it("exposes a modal dialog named by its confirmation title", () => {
      render(<EnrollmentModal action={makeActionDetail()} onClose={vi.fn()} />);

      expect(
        screen.getByRole("dialog", { name: "Confirmar inscrição" }),
      ).toHaveAttribute("aria-modal", "true");
    });

    it("ignores Escape during enrollment and allows it again after a failure", async () => {
      let release = () => {};
      const responseReady = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.post(`${API}/activities/act-pending/enroll`, async () => {
          await responseReady;
          return HttpResponse.error();
        }),
      );
      const onClose = vi.fn();
      const { user } = render(
        <EnrollmentModal
          action={makeActionDetail({ id: "act-pending" })}
          onClose={onClose}
        />,
      );

      try {
        await user.click(screen.getByRole("button", { name: /Confirmar/i }));
        await user.keyboard("{Escape}");
        expect(onClose).not.toHaveBeenCalled();
      } finally {
        release();
      }

      await screen.findByText(/Falha de comunicação/);
      expect(
        screen.getByRole("dialog", { name: "Erro ao realizar inscrição" }),
      ).toHaveAttribute("aria-modal", "true");
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes when Escape is pressed", async () => {
      const onClose = vi.fn();
      const { user } = render(
        <EnrollmentModal action={makeActionDetail()} onClose={onClose} />,
      );

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when cancel button is clicked", async () => {
      const action = makeActionDetail();
      const onClose = vi.fn();

      const { user } = render(
        <EnrollmentModal action={action} onClose={onClose} />,
      );

      const cancelButton = screen.getByRole("button", { name: /Cancelar/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("displays action details in confirm step", async () => {
      const action = makeActionDetail({
        title: "Workshop de React",
        startDate: "2026-10-15",
      });

      render(<EnrollmentModal action={action} onClose={vi.fn()} />);

      expect(screen.getByText("Workshop de React")).toBeInTheDocument();
    });
  });
});
