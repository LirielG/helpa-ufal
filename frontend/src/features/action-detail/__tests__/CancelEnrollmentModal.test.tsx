import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import {
  API,
  HttpResponse,
  delay,
  http,
  makeActionDetail,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import { CancelEnrollmentModal } from "../components/CancelEnrollmentModal";

const ACTION_ID = "act-cancel";

function recordCancellations(
  respond: () => Response | Promise<Response> = () =>
    new HttpResponse(null, { status: 204 }),
) {
  const requests: string[] = [];
  server.use(
    http.delete(`${API}/activities/${ACTION_ID}/enroll`, async () => {
      requests.push(ACTION_ID);
      return respond();
    }),
  );
  return requests;
}

function renderModal() {
  const onClose = vi.fn();
  const onCancelled = vi.fn();
  const onActivityRemoved = vi.fn();
  const onActivityClosed = vi.fn();
  const action = makeActionDetail({
    id: ACTION_ID,
    title: "Mutirão de Limpeza",
    enrollmentStatus: "APPROVED",
  });

  const view = render(
    <CancelEnrollmentModal
      action={action}
      onClose={onClose}
      onCancelled={onCancelled}
      onActivityRemoved={onActivityRemoved}
      onActivityClosed={onActivityClosed}
    />,
  );

  return { ...view, onClose, onCancelled, onActivityRemoved, onActivityClosed };
}

function getConfirmButton() {
  return screen.getByRole("button", { name: "Cancelar inscrição" });
}

function getKeepButton() {
  return screen.getByRole("button", { name: "Manter inscrição" });
}

function CancellationDialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Cancelar minha inscrição</button>
      {open && (
        <CancelEnrollmentModal
          action={makeActionDetail({ id: ACTION_ID })}
          onClose={() => setOpen(false)}
          onCancelled={() => setOpen(false)}
          onActivityRemoved={() => setOpen(false)}
          onActivityClosed={vi.fn()}
        />
      )}
    </>
  );
}

describe("CancelEnrollmentModal", () => {
  it.each(["", "scroll"])(
    "moves focus inside on open and restores the opener and overflow %j on close",
    async (overflow) => {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = overflow;
      const view = render(<CancellationDialogExample />);

      try {
        const opener = screen.getByRole("button", {
          name: "Cancelar minha inscrição",
        });
        await view.user.click(opener);

        expect(document.body.style.overflow).toBe("hidden");
        await waitFor(() => expect(getKeepButton()).toHaveFocus());
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

  it("ignores Escape during cancellation and allows it again after a failure", async () => {
    let release = () => {};
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    recordCancellations(async () => {
      await responseReady;
      return HttpResponse.error();
    });
    const { user, onClose } = renderModal();

    try {
      await user.click(getConfirmButton());
      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      release();
    }

    await screen.findByRole("alert");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when Escape is pressed", async () => {
    const { user, onClose } = renderModal();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the title, the summary and the warning", () => {
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "Cancelar inscrição" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("heading", { name: "Cancelar inscrição" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Você está prestes a cancelar sua inscrição em:"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mutirão de Limpeza")).toBeInTheDocument();
    expect(screen.getByText("20 horas")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a vaga é liberada de imediato e pode ser ocupada por outra pessoa/,
      ),
    ).toBeInTheDocument();
  });

  it("closes without a request when the user keeps the enrollment", async () => {
    const requests = recordCancellations();
    const { user, onClose } = renderModal();

    await user.click(getKeepButton());

    expect(onClose).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(0);
  });

  it("shows a toast and reports the cancellation on 204", async () => {
    recordCancellations();
    const { user, onCancelled } = renderModal();

    await user.click(getConfirmButton());

    expect(await screen.findByText("Inscrição cancelada.")).toBeInTheDocument();
    expect(onCancelled).toHaveBeenCalledOnce();
  });

  it("disables both buttons while the request is in flight", async () => {
    recordCancellations(async () => {
      await delay(50);
      return new HttpResponse(null, { status: 204 });
    });
    const { user, onCancelled } = renderModal();

    await user.click(getConfirmButton());

    expect(getKeepButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cancelando..." }),
    ).toBeDisabled();
    await waitFor(() => expect(onCancelled).toHaveBeenCalledOnce());
  });

  it("sends a single request on a double click", async () => {
    const requests = recordCancellations(async () => {
      await delay(50);
      return new HttpResponse(null, { status: 204 });
    });
    const { user, onCancelled } = renderModal();

    await user.dblClick(getConfirmButton());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledOnce());
    expect(requests).toHaveLength(1);
  });

  it("reports an already cancelled enrollment without a toast or an error", async () => {
    recordCancellations(() =>
      HttpResponse.json(
        { message: "Inscrição não encontrada", code: "ENROLLMENT_NOT_FOUND" },
        { status: 404 },
      ),
    );
    const { user, onCancelled } = renderModal();

    await user.click(getConfirmButton());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledOnce());
    expect(screen.queryByText("Inscrição cancelada.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a removed activity", async () => {
    recordCancellations(() =>
      HttpResponse.json(
        { message: "Ação não encontrada", code: "ACTIVITY_NOT_FOUND" },
        { status: 404 },
      ),
    );
    const { user, onActivityRemoved, onCancelled } = renderModal();

    await user.click(getConfirmButton());

    await waitFor(() => expect(onActivityRemoved).toHaveBeenCalledOnce());
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("shows the closed-activity message on 409 and allows another try", async () => {
    recordCancellations(() =>
      HttpResponse.json(
        { message: "Activity is not open for cancellation." },
        { status: 409 },
      ),
    );
    const { user, onCancelled, onActivityClosed } = renderModal();

    await user.click(getConfirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta ação não está mais aberta, não é possível cancelar a inscrição.",
    );
    expect(onActivityClosed).toHaveBeenCalledOnce();
    expect(onCancelled).not.toHaveBeenCalled();
    expect(getConfirmButton()).toBeEnabled();
    expect(getKeepButton()).toBeEnabled();
  });

  it.each([0, 500])(
    "shows the connection error for status %i",
    async (status) => {
      recordCancellations(() =>
        status === 0
          ? HttpResponse.error()
          : new HttpResponse(null, { status }),
      );
      const { user } = renderModal();

      await user.click(getConfirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar ao servidor. Tente novamente.",
      );
    },
  );

  it("shows a generic message on an unexpected error", async () => {
    recordCancellations(() =>
      HttpResponse.json({ message: "Validation error." }, { status: 400 }),
    );
    const { user } = renderModal();

    await user.click(getConfirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível cancelar a inscrição. Tente novamente.",
    );
  });
});
