import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { makeActionDetail, makeManagedActivity } from "@/test/factories";
import { ConfirmStatusModal } from "../ConfirmStatusModal";

describe("ConfirmStatusModal", () => {
  it.each([
    [
      "IN_PROGRESS",
      "Iniciar ação",
      "Voltar",
      "A ação passa a constar como em andamento. Novas inscrições deixam de ser aceitas.",
      "bg-blue-600",
    ],
    [
      "COMPLETED",
      "Concluir ação",
      "Voltar",
      "Depois de concluída, a ação não poderá voltar a ficar em andamento.",
      "bg-blue-600",
    ],
    [
      "CANCELLED",
      "Cancelar ação",
      "Manter ação",
      "A ação continuará visível, marcada como cancelada, e não poderá ser reaberta. Os inscritos não serão avisados automaticamente.",
      "bg-red-800",
    ],
  ] as const)(
    "renders %s copy and triggers confirm/cancel callbacks",
    async (
      pendingStatus,
      confirmLabel,
      cancelLabel,
      body,
      confirmColorClass,
    ) => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const { user } = render(
        <ConfirmStatusModal
          activity={makeManagedActivity()}
          pendingStatus={pendingStatus}
          isLoading={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );

      const dialog = screen.getByRole("dialog", { name: confirmLabel });
      expect(
        within(dialog).getByText(body, { exact: false }),
      ).toBeInTheDocument();

      await user.click(
        within(dialog).getByRole("button", { name: cancelLabel }),
      );
      expect(onCancel).toHaveBeenCalledOnce();

      const confirmButton = within(dialog).getByRole("button", {
        name: confirmLabel,
      });
      expect(confirmButton).toHaveClass(confirmColorClass);

      await user.click(
        within(dialog).getByRole("button", { name: confirmLabel }),
      );
      expect(onConfirm).toHaveBeenCalledOnce();
    },
  );

  it("disables the confirm button while loading and omits workload when details are null", () => {
    render(
      <ConfirmStatusModal
        activity={makeManagedActivity({
          action: { id: "act-1", status: "OPEN", details: null },
        })}
        pendingStatus="IN_PROGRESS"
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Iniciar ação" });
    expect(
      within(dialog).getByRole("button", { name: "Iniciar ação" }),
    ).toBeDisabled();
    expect(within(dialog).queryByText(/hora/)).not.toBeInTheDocument();
  });

  it("renders workload in singular when action has 1 hour", () => {
    render(
      <ConfirmStatusModal
        activity={makeManagedActivity({
          action: {
            id: "act-1",
            status: "IN_PROGRESS",
            details: { ...makeActionDetail().details!, workloadHours: 1 },
          },
        })}
        pendingStatus="COMPLETED"
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("1 hora")).toBeInTheDocument();
  });
});
