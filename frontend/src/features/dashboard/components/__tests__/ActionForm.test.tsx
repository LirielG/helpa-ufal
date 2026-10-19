import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@/test";
import { ActionRegister } from "../ActionForm";
import { API, futureDateInput, http, HttpResponse, server } from "@/test";
import type { UserEvent } from "@testing-library/user-event";
import { ACTIVITY_TITLE_MAX_LENGTH } from "@/validators/limits";

function getAreaField() {
  return screen.getByLabelText("Área de atuação");
}

/**
 * The area field is free text with a `<datalist>` of suggestions, so the
 * suggestions are the options of the list the input points to.
 */
function areaSuggestions(): string[] {
  const datalist = (getAreaField() as HTMLInputElement).list;

  if (!datalist) return [];

  return within(datalist)
    .queryAllByRole("option", { hidden: true })
    .map((option) => (option as HTMLOptionElement).value);
}

/** Replaces the create handler with a spy over the request body. */
function spyOnCreate() {
  const onRequest = vi.fn();

  server.use(
    http.post(`${API}/activities`, async ({ request }) => {
      onRequest(await request.json());
      return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
    }),
  );

  return onRequest;
}

async function fillStep1(user: UserEvent, area = "Educação") {
  await user.type(
    screen.getByPlaceholderText("Digite o título da sua ação"),
    "Mutirão de Saúde",
  );
  await user.type(
    screen.getByLabelText("Descrição completa"),
    "Atendimento gratuito à comunidade.",
  );

  await user.type(getAreaField(), area);
  await user.selectOptions(screen.getByLabelText("Tipo da ação"), "EXTENSION");

  await user.click(screen.getByRole("button", { name: /Próximo/i }));

  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Conte-nos onde e quando será" }),
    ).toBeInTheDocument();
  });
}

async function fillStep2(user: UserEvent) {
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

  fireEvent.change(screen.getByLabelText("Data de início"), {
    target: { value: futureDateInput() },
  });
  fireEvent.change(screen.getByLabelText("Data de encerramento"), {
    target: { value: futureDateInput() },
  });
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

  it("keeps a title over the length limit on step 1 without creating the action", async () => {
    const onCreate = spyOnCreate();
    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(
      screen.getByPlaceholderText("Digite o título da sua ação"),
    );
    await user.paste("a".repeat(ACTIVITY_TITLE_MAX_LENGTH + 1));
    await user.type(getAreaField(), "Educação");
    await user.selectOptions(
      screen.getByLabelText("Tipo da ação"),
      "EXTENSION",
    );
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(
      await screen.findByText("O título deve ter no máximo 150 caracteres."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Conte-nos onde e quando será" }),
    ).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  describe("area field", () => {
    function serveAreas(areas: string[]) {
      server.use(
        http.get(`${API}/activities/filters`, () =>
          HttpResponse.json({ areas }),
        ),
      );
    }

    async function createWithArea(user: UserEvent, area: string) {
      await fillStep1(user, area);
      await fillStep2(user);
      await user.click(screen.getByRole("button", { name: /Criar ação/i }));
    }

    it("suggests the areas returned by GET /activities/filters and nothing else", async () => {
      serveAreas(["Robótica Educacional", "Saúde", "Saude"]);

      render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await waitFor(() =>
        expect(areaSuggestions()).toEqual([
          "Robótica Educacional",
          "Saúde",
          "Saude",
        ]),
      );
    });

    it("creates the action with an area that is not among the suggestions", async () => {
      serveAreas(["Educação", "Saúde"]);
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await createWithArea(user, "Astronomia Amadora");

      await waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ area: "Astronomia Amadora" }),
        ),
      );
      expect(
        await screen.findByText("Sua ação foi registrada com sucesso!"),
      ).toBeInTheDocument();
    });

    it("sends a chosen suggestion exactly as suggested", async () => {
      serveAreas(["Saúde da Família", "Meio Ambiente"]);
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await waitFor(() => expect(areaSuggestions()).toHaveLength(2));
      const [suggestion] = areaSuggestions();

      await createWithArea(user, suggestion);

      await waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ area: "Saúde da Família" }),
        ),
      );
    });

    it("trims the spaces around the area before sending it", async () => {
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await createWithArea(user, "  Astronomia Amadora  ");

      await waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ area: "Astronomia Amadora" }),
        ),
      );
    });

    it("rejects an area made only of spaces", async () => {
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await user.type(
        screen.getByPlaceholderText("Digite o título da sua ação"),
        "Mutirão de Saúde",
      );
      await user.type(getAreaField(), "   ");
      await user.selectOptions(
        screen.getByLabelText("Tipo da ação"),
        "EXTENSION",
      );
      await user.click(screen.getByRole("button", { name: /Próximo/i }));

      expect(
        await screen.findByText("Informe uma área de atuação válida."),
      ).toBeInTheDocument();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("still creates the action when the suggestions fail to load", async () => {
      server.use(
        http.get(`${API}/activities/filters`, () =>
          HttpResponse.json(
            { message: "Internal server error." },
            { status: 500 },
          ),
        ),
      );
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await createWithArea(user, "Astronomia Amadora");

      await waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ area: "Astronomia Amadora" }),
        ),
      );
      expect(
        await screen.findByText("Sua ação foi registrada com sucesso!"),
      ).toBeInTheDocument();
    });
  });

  describe("description field", () => {
    async function submitStep1WithDescription(
      user: UserEvent,
      description: string,
    ) {
      await user.type(
        screen.getByPlaceholderText("Digite o título da sua ação"),
        "Mutirão de Saúde",
      );
      if (description) {
        await user.type(
          screen.getByLabelText("Descrição completa"),
          description,
        );
      }
      await user.type(getAreaField(), "Educação");
      await user.selectOptions(
        screen.getByLabelText("Tipo da ação"),
        "EXTENSION",
      );
      await user.click(screen.getByRole("button", { name: /Próximo/i }));
    }

    function step2Heading() {
      return screen.queryByRole("heading", {
        name: "Conte-nos onde e quando será",
      });
    }

    it("keeps an empty description on step 1 and says it is required", async () => {
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await submitStep1WithDescription(user, "");

      expect(
        await screen.findByText("A descrição é obrigatória"),
      ).toBeInTheDocument();
      expect(step2Heading()).toBeNull();
    });

    it("keeps a description shorter than 10 characters on step 1", async () => {
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await submitStep1WithDescription(user, "123456789");

      expect(
        await screen.findByText("A descrição deve ter no mínimo 10 caracteres"),
      ).toBeInTheDocument();
      expect(step2Heading()).toBeNull();
    });

    it("advances with a description of exactly 10 characters", async () => {
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await submitStep1WithDescription(user, "1234567890");

      expect(
        await screen.findByRole("heading", {
          name: "Conte-nos onde e quando será",
        }),
      ).toBeInTheDocument();
    });

    it("sends the typed description without the spaces around it", async () => {
      const onCreate = spyOnCreate();
      const { user } = render(
        <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      );

      await submitStep1WithDescription(user, "  Oficina de leitura  ");
      await screen.findByRole("heading", {
        name: "Conte-nos onde e quando será",
      });
      await fillStep2(user);
      await user.click(screen.getByRole("button", { name: /Criar ação/i }));

      await waitFor(() =>
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ description: "Oficina de leitura" }),
        ),
      );
    });
  });

  it("names the current step for screens without the side bar", async () => {
    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    expect(
      screen.getByText("Etapa 1 de 2 · Identificação"),
    ).toBeInTheDocument();

    await fillStep1(user);

    expect(screen.getByText("Etapa 2 de 2 · Logística")).toBeInTheDocument();
  });

  it("labels the fields the same way as the edit form", async () => {
    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    expect(screen.getByLabelText("Tipo da ação")).toBeInTheDocument();

    await fillStep1(user);

    for (const label of [
      "Número de vagas",
      "Data de início",
      "Data de encerramento",
      "Horário de início",
      "Horário de encerramento",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("shows the link field only for online and hybrid actions", async () => {
    const { user } = render(
      <ActionRegister isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await fillStep1(user);
    const format = screen.getByLabelText("Formato da ação");

    await user.selectOptions(format, "IN_PERSON");
    expect(screen.queryByLabelText(/link/i)).not.toBeInTheDocument();

    await user.selectOptions(format, "ONLINE");
    expect(screen.getByLabelText("Link para o evento")).toBeInTheDocument();

    await user.selectOptions(format, "HYBRID");
    expect(screen.getByLabelText("Link para o evento")).toBeInTheDocument();
  });
});
