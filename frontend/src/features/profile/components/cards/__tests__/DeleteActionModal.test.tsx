import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { DeleteActionModal } from "../DeleteActionModal";

describe("DeleteActionModal", () => {
  it("renders confirmation dialog and triggers confirm/cancel callbacks", async () => {
    const onConfirmDelete = vi.fn();
    const onClose = vi.fn();
    const { user } = render(
      <DeleteActionModal onConfirmDelete={onConfirmDelete} onClose={onClose} />,
    );

    expect(
      screen.getByRole("dialog", { name: "Confirmar exclusão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/será completamente excluída e não terá como recorrer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Excluir não é o mesmo que cancelar/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Não" }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Sim" }));
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });

  it("disables buttons while loading and displays error alerts", () => {
    render(
      <DeleteActionModal
        isLoading={true}
        errorMessage="Erro ao excluir."
        onConfirmDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao excluir.");
    expect(screen.getByRole("button", { name: "Não" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
  });
});
