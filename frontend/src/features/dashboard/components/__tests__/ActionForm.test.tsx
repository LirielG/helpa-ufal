import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test";
import { ActionRegister } from "../ActionForm";
import { http, HttpResponse, server } from "@/test";

async function fillStep1(user: any) {
  await user.type(
    screen.getByPlaceholderText("Digite o título da sua ação"),
    "Mutirão de Saúde",
  );

  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0], "Educação");
  await user.selectOptions(selects[1], "EXTENSION");

  await user.click(screen.getByRole("button", { name: /Próximo/i }));

  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Conte-nos onde e quando será" }),
    ).toBeInTheDocument();
  });
}

async function fillStep2(user: any) {
  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0], "ARAPIRACA");
  await user.selectOptions(selects[1], "ONLINE");

  const numberInputs = screen.getAllByRole("spinbutton");
  await user.type(numberInputs[0], "4");
  await user.type(numberInputs[1], "50");

  await user.type(
    screen.getByPlaceholderText(/Ex: https:\/\/meet.google.com/i),
    "https://meet.google.com/abc",
  );

  const dateInputs = document.querySelectorAll('input[type="date"]');
  if (dateInputs.length >= 2) {
    fireEvent.change(dateInputs[0], { target: { value: "2026-10-10" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-10-10" } });
  }
}

describe("ActionRegister", () => {
  it("closes the modal directly without confirmation if the form is untouched", async () => {
    const onCloseMock = vi.fn();
    const { user } = render(
      <ActionRegister
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByText("Descartar esta ação?")).toBeNull();
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before discarding a modified form", async () => {
    const onCloseMock = vi.fn();
    const { user } = render(
      <ActionRegister
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(
      screen.getByPlaceholderText("Digite o título da sua ação"),
      "Ação de Limpeza",
    );
    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.getByText("Descartar esta ação?")).toBeInTheDocument();
    expect(onCloseMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Descartar/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("creates the action successfully and shows the confirmation modal", async () => {
    const onSuccessMock = vi.fn();

    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
      }),
    );

    const { user } = render(
      <ActionRegister
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccessMock}
      />,
    );

    await fillStep1(user);
    await fillStep2(user);

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sua ação foi registrada com sucesso!"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Visualizar no feed/i }),
    );
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it("returns to Step 1 if the API returns a validation error for a Step 1 field", async () => {
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json(
          {
            errors: [{ field: "title", message: "Title is required" }],
          },
          { status: 400 },
        );
      }),
    );

    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await fillStep1(user);
    await fillStep2(user);

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Dê um nome para a sua ação" }),
      ).toBeInTheDocument();
    });
  });

  it("displays a generic error message in case of server/network failure", async () => {
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json(
          { message: "Internal Server Error" },
          { status: 500 },
        );
      }),
    );

    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await fillStep1(user);
    await fillStep2(user);

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível criar a ação. Tente novamente.",
      );
    });
  });
});
