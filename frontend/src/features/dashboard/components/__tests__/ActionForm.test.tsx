import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test";
import { ActionRegister } from "../ActionForm";
import { http, HttpResponse, server } from "@/test";

describe("ActionRegister", () => {
  it("fecha o modal direto sem confirmar se o formulário estiver intocado", async () => {
    const onCloseMock = vi.fn();
    const { user } = render(
      <ActionRegister isOpen={true} onClose={onCloseMock} onSuccess={vi.fn()} />
    );

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByText("Descartar esta ação?")).toBeNull();
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("pede confirmação antes de descartar um formulário modificado", async () => {
    const onCloseMock = vi.fn();
    const { user } = render(
      <ActionRegister isOpen={true} onClose={onCloseMock} onSuccess={vi.fn()} />
    );

    const titleInput = screen.getByPlaceholderText("Digite o título da sua ação");
    await user.type(titleInput, "Ação de Limpeza");

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.getByText("Descartar esta ação?")).toBeInTheDocument();
    
    expect(onCloseMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Descartar/i }));

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("cria a ação com sucesso e exibe o modal de confirmação", async () => {
    const onSuccessMock = vi.fn();
    
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
      })
    );

    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={onSuccessMock} />
    );

    await user.type(screen.getByPlaceholderText("Digite o título da sua ação"), "Mutirão de Saúde");
    
    const selectsStep1 = screen.getAllByRole("combobox");
    await user.selectOptions(selectsStep1[0], "Saúde");
    await user.selectOptions(selectsStep1[1], "EXTENSION");
    
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByRole("heading", { name: "Conte-nos onde e quando será" })).toBeInTheDocument();

    const selectsStep2 = screen.getAllByRole("combobox");
    await user.selectOptions(selectsStep2[0], "ARAPIRACA");
    await user.selectOptions(selectsStep2[1], "ONLINE");
    
    const numberInputs = screen.getAllByPlaceholderText("ex: 12");
    await user.type(numberInputs[0], "4");
    await user.type(numberInputs[1], "50");

    await user.type(screen.getByPlaceholderText(/Ex: meet.google.com/i), "https://meet.google.com/abc");

    const dateInputs = document.querySelectorAll('input[type="date"]');
    
    if (dateInputs.length >= 2) {
        await user.type(dateInputs[0] as HTMLElement, "2026-10-10");
        await user.type(dateInputs[1] as HTMLElement, "2026-10-10");
    }

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(screen.getByText("Sua ação foi registrada com sucesso!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Visualizar no feed/i }));
    
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it("retorna ao Passo 1 se a API retornar erro de validação em um campo do Passo 1", async () => {
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json({
          errors: [{ field: "title", message: "Title is required" }]
        }, { status: 400 });
      })
    );

    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText("Digite o título da sua ação"), "A");
    const selectsStep1 = screen.getAllByRole("combobox");
    await user.selectOptions(selectsStep1[0], "Educação");
    await user.selectOptions(selectsStep1[1], "EVENT");
    
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByRole("heading", { name: "Conte-nos onde e quando será" })).toBeInTheDocument();
  });
  
  it("exibe mensagem de erro genérica em caso de falha de rede", async () => {
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json({ message: "Internal Server Error" }, { status: 500 });
      })
    );

    const { user } = render(<ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);
    
    const forms = document.querySelectorAll('form');
    forms.forEach(f => f.setAttribute('novalidate', 'true'));

    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível criar a ação/i)).toBeInTheDocument();
    });
  });
});
