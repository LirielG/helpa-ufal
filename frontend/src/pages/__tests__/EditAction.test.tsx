import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  HttpResponse,
  delay,
  fireEvent,
  http,
  makeActionDetail,
  render,
  screen,
  server,
  waitFor,
  within,
} from "@/test";
import type { ActionDetail, ActionDetails } from "@/features/action-detail/types";
import type { ActionAddressPayload } from "@/features/action-edit/types";
import { EditAction } from "../EditAction";

const ACTION_ID = "action-1";

const ADDRESS: ActionAddressPayload = {
  addressLine: "Av. Manoel Severino Barbosa, s/n",
  district: "Bom Sucesso",
  zipCode: "57309005",
  city: "Arapiraca",
  state: "AL",
};

type EditableAction = ActionDetail & { details: ActionDetails };

function editableAction(
  details: Partial<ActionDetails> = {},
  action: Partial<ActionDetail> = {},
): EditableAction {
  const base = makeActionDetail({ id: ACTION_ID, ...action });

  return {
    ...base,
    details: {
      ...(base.details as ActionDetails),
      area: "Robótica",
      url: "https://exemplo.com/oficina",
      address: { id: "address-1", ...ADDRESS },
      ...details,
    },
  };
}

function mockAction(action: ActionDetail = editableAction()) {
  server.use(
    http.get(`${API}/activities/:id`, () => HttpResponse.json(action)),
  );

  return action;
}

/**
 * Replaces the update handler with a spy over the request body, so each test
 * can assert the exact payload the screen built.
 */
function spyOnUpdate(onResponse?: () => Promise<void>) {
  const onRequest = vi.fn();

  server.use(
    http.patch(`${API}/activities/:id`, async ({ request }) => {
      onRequest(await request.json());
      await onResponse?.();
      return HttpResponse.json(editableAction());
    }),
  );

  return onRequest;
}

function failUpdate(status: number, body: unknown = {}) {
  server.use(
    http.patch(`${API}/activities/:id`, () =>
      HttpResponse.json(body, { status }),
    ),
  );
}

/**
 * The destination routes are part of the tree so a redirect is observed
 * through what ends up on screen, rather than by spying on `useNavigate`.
 */
function renderEditAction() {
  return render(
    <Routes>
      <Route path="/activity/:id/edit" element={<EditAction />} />
      <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
      <Route path="/login" element={<h1>Entrar</h1>} />
    </Routes>,
    { route: `/activity/${ACTION_ID}/edit` },
  );
}

/** Resolves once the fetched action is in the form. */
function findTitleField() {
  return screen.findByLabelText("Título");
}

function getSaveButton() {
  return screen.getByRole("button", { name: "Salvar" });
}

function optionLabels(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("EditAction", () => {
  it("loads the action from the API into the form", async () => {
    const action = mockAction();

    renderEditAction();

    expect(await findTitleField()).toHaveValue(action.title);
    expect(screen.getByPlaceholderText(/Descreva os detalhes/)).toHaveValue(
      action.details.description,
    );
    expect(screen.getByLabelText("Qtde. de Vagas")).toHaveValue(action.slots);
    expect(screen.getByLabelText("Carga horária")).toHaveValue(20);
    expect(screen.getByLabelText("Tipo de ação")).toHaveValue("COURSE");
    expect(screen.getByLabelText("Formato da ação")).toHaveValue("IN_PERSON");
    expect(screen.getByLabelText("Área de atuação")).toHaveValue("Robótica");
    expect(screen.getByLabelText("Campus")).toHaveValue("ARAPIRACA");
    expect(screen.getByLabelText("Link do evento")).toHaveValue(
      action.details.url,
    );
    expect(screen.getByLabelText("Logradouro")).toHaveValue(
      ADDRESS.addressLine,
    );
    expect(screen.getByLabelText("Bairro")).toHaveValue(ADDRESS.district);
    expect(screen.getByLabelText("Cidade")).toHaveValue(ADDRESS.city);
    expect(screen.getByLabelText("Estado")).toHaveValue(ADDRESS.state);
  });

  it("shows the masked zip code and the local end date", async () => {
    // The API stores the end of the day in UTC, which in America/Maceio falls
    // on the next calendar day, so the ISO prefix is not the value to show.
    mockAction(editableAction({}, { endDate: "2026-03-18T02:59:59.999Z" }));

    renderEditAction();

    await findTitleField();

    expect(screen.getByLabelText("CEP")).toHaveValue("57309-005");
    expect(screen.getByLabelText("Data de encerramento")).toHaveValue(
      "2026-03-17",
    );
  });

  it("does not show the responsible card", async () => {
    mockAction();

    renderEditAction();

    await findTitleField();

    expect(screen.queryByText(/respons[áa]vel/i)).not.toBeInTheDocument();
  });

  it("offers the type, format, area and campus vocabulary closed in #171", async () => {
    mockAction();

    renderEditAction();

    await findTitleField();

    expect(optionLabels(screen.getByLabelText("Tipo de ação"))).toEqual([
      "Extensão",
      "Curso ou minicurso",
      "Evento",
      "Palestra",
      "Outro",
    ]);
    expect(optionLabels(screen.getByLabelText("Formato da ação"))).toEqual([
      "Presencial",
      "On-line",
      "Híbrido",
    ]);
    expect(optionLabels(screen.getByLabelText("Área de atuação"))).toEqual([
      "Robótica",
      "Educação",
      "Saúde",
      "Meio Ambiente",
      "Arquitetura",
    ]);
    expect(optionLabels(screen.getByLabelText("Campus"))).toEqual([
      "UFAL - Campus Maceió",
      "UFAL - Campus Arapiraca",
      "UFAL - Campus Palmeira dos Índios",
      "UFAL - Campus Penedo",
      "UFAL - Campus Rio Largo",
      "UFAL - Campus Delmiro Gouveia",
      "UFAL - Campus Santana do Ipanema",
    ]);
  });

  it("sends only the changed fields and goes to the action detail", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    const slots = await screen.findByLabelText("Qtde. de Vagas");
    await user.clear(slots);
    await user.type(slots, "45");
    await user.click(getSaveButton());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ slots: 45 }));
    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
  });

  it("sends the whole address block when a single subfield changes", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const district = screen.getByLabelText("Bairro");
    await user.clear(district);
    await user.type(district, "Centro");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        address: { ...ADDRESS, district: "Centro" },
      }),
    );
  });

  it("sends the link of an in-person action when it is edited", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link do evento");
    await user.clear(url);
    await user.type(url, "https://exemplo.com/novo");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        url: "https://exemplo.com/novo",
      }),
    );
  });

  it("uppercases a state typed in lower case", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const state = screen.getByLabelText("Estado");
    await user.clear(state);
    await user.type(state, "se");

    expect(state).toHaveValue("SE");

    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        address: { ...ADDRESS, state: "SE" },
      }),
    );
  });

  it("blocks an incomplete zip code before any request goes out", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const zipCode = screen.getByLabelText("CEP");
    await user.clear(zipCode);
    await user.type(zipCode, "5730");
    await user.click(getSaveButton());

    expect(await screen.findByText("O CEP deve ter 8 dígitos")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("keeps an action editable when its area is outside the closed list", async () => {
    mockAction(editableAction({ area: "Tecnologia e Inovação" }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    const title = await findTitleField();

    expect(screen.getByLabelText("Área de atuação")).toHaveValue(
      "Tecnologia e Inovação",
    );

    await user.clear(title);
    await user.type(title, "Oficina de Robótica");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ title: "Oficina de Robótica" }),
    );
  });

  it("makes no request and stays on the form when nothing changed", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();
    await user.click(getSaveButton());

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("Detalhe da ação")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
  });

  it("asks for confirmation before turning the action online", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();
    await user.selectOptions(screen.getByLabelText("Formato da ação"), "ONLINE");
    await user.click(getSaveButton());

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(/dados de endereço .* serão excluídos/i),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        format: "ONLINE",
        url: "https://exemplo.com/oficina",
      }),
    );
  });

  it("sends nothing and returns to the form when the confirmation is cancelled", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();
    await user.selectOptions(screen.getByLabelText("Formato da ação"), "ONLINE");
    await user.click(getSaveButton());

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
  });

  it("reports every empty address field when the action becomes in-person", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();
    await user.selectOptions(
      screen.getByLabelText("Formato da ação"),
      "IN_PERSON",
    );
    await user.click(getSaveButton());

    expect(await screen.findByText("Informe o logradouro")).toBeInTheDocument();
    expect(screen.getByText("Informe o bairro")).toBeInTheDocument();
    expect(screen.getByText("Informe o CEP")).toBeInTheDocument();
    expect(screen.getByText("Informe a cidade")).toBeInTheDocument();
    expect(screen.getByText("Informe o estado")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("translates the slots error the API answers with", async () => {
    mockAction();
    failUpdate(400, {
      status: 400,
      message: "Validation error.",
      errors: [
        {
          field: "slots",
          message:
            "slots cannot be reduced below the current number of approved enrollments (15).",
        },
      ],
    });
    const { user } = renderEditAction();

    const slots = await screen.findByLabelText("Qtde. de Vagas");
    await user.clear(slots);
    await user.type(slots, "5");
    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "A quantidade de vagas não pode ser menor que o número atual de inscrições aprovadas (15).",
      ),
    ).toBeInTheDocument();
  });

  it("shows a pt-BR message when the API rejects the zip code", async () => {
    mockAction();
    failUpdate(400, {
      status: 400,
      message: "Validation error.",
      errors: [
        {
          field: "address.zipCode",
          message: "zipCode must contain exactly 8 digits.",
        },
      ],
    });
    const { user } = renderEditAction();

    await findTitleField();

    const city = screen.getByLabelText("Cidade");
    await user.clear(city);
    await user.type(city, "Maceió");
    await user.click(getSaveButton());

    expect(
      await screen.findByText("O CEP deve ter 8 dígitos."),
    ).toBeInTheDocument();
  });

  it("shows the permission message on 403", async () => {
    mockAction();
    failUpdate(403);
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título sem permissão");
    await user.click(getSaveButton());

    expect(
      await screen.findByText("Apenas o autor ou gestor pode editar esta ação."),
    ).toBeInTheDocument();
  });

  it("shows the removed-action message when the update answers 404", async () => {
    mockAction();
    failUpdate(404);
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título de ação removida");
    await user.click(getSaveButton());

    expect(
      await screen.findByText("Ação não encontrada ou removida."),
    ).toBeInTheDocument();
  });

  it("shows the closed-action message on 409", async () => {
    mockAction();
    failUpdate(409);
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título de ação concluída");
    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "Ações concluídas ou canceladas não podem ser editadas.",
      ),
    ).toBeInTheDocument();
  });

  it("goes to the login screen on 401", async () => {
    mockAction();
    failUpdate(401);
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título com sessão expirada");
    await user.click(getSaveButton());

    expect(await screen.findByText("Entrar")).toBeInTheDocument();
  });

  it("keeps what was typed when the update fails with a server error", async () => {
    mockAction();
    failUpdate(500, { message: "Internal server error." });
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título preservado após o erro");
    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "Ocorreu um erro ao atualizar a ação. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Título preservado após o erro",
    );
  });

  it("shows the not-found screen when the action does not exist", async () => {
    server.use(
      http.get(
        `${API}/activities/:id`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    renderEditAction();

    expect(await screen.findByText("Ação não encontrada.")).toBeInTheDocument();
  });

  it("sends a single request when save is clicked twice", async () => {
    mockAction();
    const onUpdate = spyOnUpdate(() => delay(200));
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título com clique duplo");

    const save = getSaveButton();
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
