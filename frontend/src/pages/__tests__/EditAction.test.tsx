import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test";
import { EditAction } from "../EditAction";

const mockNavigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useParams: () => ({ id: "123" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "123" }),
    useNavigate: () => mockNavigate,
  };
});

const mockActionData = {
  id: "123",
  title: "Oficina de React Real",
  type: "COURSE",
  status: "OPEN",
  slots: 30,
  campus: "MACEIO",
  startDate: "2026-10-10",
  endDate: "2026-10-20",
  details: {
    description: "Descrição vinda da API real com tamanho suficiente",
    workloadHours: 20,
    format: "IN_PERSON",
    area: "Robótica",
    url: "https://exemplo.com",
    address: {
      addressLine: "Av. Lourival Melo Mota, s/n",
      district: "Cidade Universitária",
      city: "Maceió",
      state: "AL",
      zipCode: "57072970",
    },
  },
};

const setupGetSuccess = () => {
  server.use(
    http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData))
  );
};

describe("EditAction Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reproduz o layout com título, descrição largura total e botões Cancelar e Salvar", async () => {
    setupGetSuccess();

    render(<EditAction />);

    expect(await screen.findByDisplayValue("Oficina de React Real")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Descrição vinda da API real/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("não exibe o card de responsável", async () => {
    setupGetSuccess();

    render(<EditAction />);

    await screen.findByDisplayValue("Oficina de React Real");

    expect(screen.queryByText(/responsável/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("responsible-card")).not.toBeInTheDocument();
  });

  it("carrega os dados reais da ação ao abrir a tela de edição", async () => {
    setupGetSuccess();

    render(<EditAction />);

    expect(await screen.findByDisplayValue("Oficina de React Real")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-10-10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-10-20")).toBeInTheDocument();
  });

  it("exibe todos os 12 campos do formulário e permite alterá-los individualmente", async () => {
    const user = userEvent.setup();
    setupGetSuccess();

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    const descInput = screen.getByDisplayValue(/Descrição vinda da API real/i);
    const startDateInput = screen.getByDisplayValue("2026-10-10");
    const endDateInput = screen.getByDisplayValue("2026-10-20");
    const typeSelect = screen.getByDisplayValue("Curso ou minicurso");
    const slotsInput = screen.getByDisplayValue("30");
    const formatSelect = screen.getByDisplayValue("Presencial");
    const workloadInput = screen.getByDisplayValue("20");
    const areaSelect = screen.getByDisplayValue("Robótica");
    const urlInput = screen.getByDisplayValue("https://exemplo.com");
    const addressInput = screen.getByDisplayValue("Av. Lourival Melo Mota, s/n");
    const campusSelect = screen.getByDisplayValue("UFAL - Campus Maceió");

    expect(titleInput).toHaveAttribute("name", "title");
    expect(descInput).toHaveAttribute("name", "description");
    expect(startDateInput).toHaveAttribute("name", "startDate");
    expect(endDateInput).toHaveAttribute("name", "endDate");
    expect(typeSelect).toHaveAttribute("name", "type");
    expect(slotsInput).toHaveAttribute("name", "slots");
    expect(formatSelect).toHaveAttribute("name", "format");
    expect(workloadInput).toHaveAttribute("name", "workloadHours");
    expect(areaSelect).toHaveAttribute("name", "area");
    expect(urlInput).toHaveAttribute("name", "url");
    expect(addressInput).toHaveAttribute("name", "address.addressLine");
    expect(campusSelect).toHaveAttribute("name", "campus");

    await user.clear(titleInput);
    await user.type(titleInput, "Título Editado Válido");
    expect(titleInput).toHaveValue("Título Editado Válido");

    await user.clear(descInput);
    await user.type(descInput, "Nova descrição editada com texto suficiente");
    expect(descInput).toHaveValue("Nova descrição editada com texto suficiente");

    fireEvent.change(startDateInput, { target: { value: "2026-11-01" } });
    expect(startDateInput).toHaveValue("2026-11-01");

    fireEvent.change(endDateInput, { target: { value: "2026-11-10" } });
    expect(endDateInput).toHaveValue("2026-11-10");

    await user.clear(slotsInput);
    await user.type(slotsInput, "50");
    expect(slotsInput).toHaveValue(50);

    await user.clear(workloadInput);
    await user.type(workloadInput, "40");
    expect(workloadInput).toHaveValue(40);

    await user.clear(urlInput);
    await user.type(urlInput, "https://novo-link.com");
    expect(urlInput).toHaveValue("https://novo-link.com");

    await user.clear(addressInput);
    await user.type(addressInput, "Nova Rua 456");
    expect(addressInput).toHaveValue("Nova Rua 456");
  });

  it("exibe os rótulos e opções corretas em pt-BR nos selects de tipo, formato, área e campus", async () => {
    setupGetSuccess();
    render(<EditAction />);

    await screen.findByDisplayValue("Oficina de React Real");

    const formatSelect = screen.getByDisplayValue("Presencial");
    expect(formatSelect).toHaveTextContent("Presencial");
    expect(formatSelect).toHaveTextContent("On-line");
    expect(formatSelect).toHaveTextContent("Híbrido");

    const typeSelect = screen.getByDisplayValue("Curso ou minicurso");
    expect(typeSelect).toHaveTextContent("Curso ou minicurso");

    const areaSelect = screen.getByDisplayValue("Robótica");
    expect(areaSelect).toBeInTheDocument();

    const campusSelect = screen.getByDisplayValue("UFAL - Campus Maceió");
    expect(campusSelect).toBeInTheDocument();
  });

  it("persiste a mudança ao corrigir o endereço de uma ação já publicada", async () => {
    const user = userEvent.setup();
    let sentAddress: Record<string, unknown> | undefined;

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async ({ request }) => {
        const body = (await request.json()) as { address?: Record<string, unknown> };
        sentAddress = body.address;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const addressInput = await screen.findByDisplayValue("Av. Lourival Melo Mota, s/n");
    await user.clear(addressInput);
    await user.type(addressInput, "Rua das Flores, 123");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(sentAddress).toBeDefined();
      expect(sentAddress?.addressLine).toBe("Rua das Flores, 123");
    });
  });

  it("persiste a mudança de um campo e redireciona para a tela da ação", async () => {
    const user = userEvent.setup();
    let patchPayload: Record<string, unknown> = {};

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async ({ request }) => {
        patchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Título Atualizado Válido");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(patchPayload).toEqual({ title: "Título Atualizado Válido" });
      expect(mockNavigate).toHaveBeenCalledWith("/activity/123");
    });
  });

  it("não dispara requisição HTTP PATCH ao salvar sem alterar nada", async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () => {
        patchCalled = true;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    await screen.findByDisplayValue("Oficina de React Real");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/activity/123");
    });

    expect(patchCalled).toBe(false);
  });

  it("envia somente os campos alterados no corpo do PATCH", async () => {
    const user = userEvent.setup();
    let patchPayload: Record<string, unknown> = {};

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async ({ request }) => {
        patchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const slotsInput = await screen.findByDisplayValue("30");
    await user.clear(slotsInput);
    await user.type(slotsInput, "45");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(patchPayload).toEqual({ slots: 45 });
      expect(patchPayload).not.toHaveProperty("title");
    });
  });

  it("envia o CEP sanitizado apenas com dígitos para a API", async () => {
    const user = userEvent.setup();
    let sentZipCode = "";

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async ({ request }) => {
        const body = (await request.json()) as { address?: { zipCode?: string } };
        sentZipCode = body.address?.zipCode || "";
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const zipInput = await screen.findByDisplayValue("57072-970");
    await user.clear(zipInput);
    await user.type(zipInput, "57000000");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(sentZipCode).toBe("57000000");
    });
  });

  it("exibe modal de confirmação ao mudar o formato para ONLINE e envia após confirmar", async () => {
    const user = userEvent.setup();
    let patchPayload: Record<string, unknown> = {};

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async ({ request }) => {
        patchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const formatSelect = await screen.findByDisplayValue("Presencial");
    await user.selectOptions(formatSelect, "ONLINE");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    expect(await screen.findByText(/Confirmar alteração/i)).toBeInTheDocument();
    expect(screen.getByText(/dados de endereço anteriormente associados a esta ação serão excluídos/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /^confirmar$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(patchPayload.format).toBe("ONLINE");
    });
  });

  it("mudar o formato para presencial ou híbrido sem endereço preenchido é bloqueado pelo schema", async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    const onlineData = {
      ...mockActionData,
      details: {
        ...mockActionData.details,
        format: "ONLINE",
        address: null,
      },
    };

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(onlineData)),
      http.patch(/\/activities\/123/, () => {
        patchCalled = true;
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const formatSelect = await screen.findByDisplayValue("On-line");
    const saveButton = screen.getByRole("button", { name: /salvar/i });

    await user.selectOptions(formatSelect, "IN_PERSON");
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Endereço completo é obrigatório/i)).toBeInTheDocument();
    });
    expect(patchCalled).toBe(false);

    await user.selectOptions(formatSelect, "HYBRID");
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Endereço completo é obrigatório/i)).toBeInTheDocument();
    });
    expect(patchCalled).toBe(false);
  });

  it("reduzir vagas exibe erro retornado pela API no campo de vagas", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () =>
        HttpResponse.json(
          { message: "O número mínimo de vagas permitido é 15 inscritos atuais." },
          { status: 400 }
        )
      )
    );

    render(<EditAction />);

    const slotsInput = await screen.findByDisplayValue("30");
    await user.clear(slotsInput);
    await user.type(slotsInput, "5");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    expect(
      await screen.findByText(/O número mínimo de vagas permitido é 15 inscritos atuais/i)
    ).toBeInTheDocument();
  });

  it("editar ação concluída exibe mensagem de erro 409", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () =>
        HttpResponse.json(
          { message: "Ações concluídas ou canceladas não podem ser editadas." },
          { status: 409 }
        )
      )
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Título Alterado Novo");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    expect(
      await screen.findByText(/Ações concluídas ou canceladas não podem ser editadas/i)
    ).toBeInTheDocument();
  });

  it("usuário sem permissão recebe mensagem de permissão 403 em pt-BR", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () =>
        HttpResponse.json({}, { status: 403 })
      )
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Título Permissão Teste");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    expect(
      await screen.findByText(/Apenas o autor ou gestor pode editar esta ação/i)
    ).toBeInTheDocument();
  });

  it("ação inexistente exibe mensagem de ação não encontrada", async () => {
    server.use(
      http.get(/\/activities\/123/, () => new HttpResponse(null, { status: 404 }))
    );

    render(<EditAction />);

    expect(await screen.findByText("Ação não encontrada.")).toBeInTheDocument();
  });

  it("status 401 redireciona para o login", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () => new HttpResponse(null, { status: 401 }))
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Título Auth Test");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("falha 500 preserva o formulário preenchido", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, () =>
        HttpResponse.json({ message: "Erro interno" }, { status: 500 })
      )
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Texto Preservado Apos Erro");

    const saveButton = screen.getByRole("button", { name: /salvar/i });
    await user.click(saveButton);

    expect(await screen.findByDisplayValue("Texto Preservado Apos Erro")).toBeInTheDocument();
  });

  it("clique duplo em salvar não dispara duas requisições concorrentes", async () => {
    const user = userEvent.setup();
    let patchCallCount = 0;

    server.use(
      http.get(/\/activities\/123/, () => HttpResponse.json(mockActionData)),
      http.patch(/\/activities\/123/, async () => {
        patchCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({});
      })
    );

    render(<EditAction />);

    const titleInput = await screen.findByDisplayValue("Oficina de React Real");
    await user.clear(titleInput);
    await user.type(titleInput, "Clique Duplo Teste");

    const saveButton = screen.getByRole("button", { name: /salvar/i });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(patchCallCount).toBe(1);
    });
  });
});