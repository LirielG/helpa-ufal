import { describe, expect, it, vi } from "vitest";
import { Link, Route, Routes, useNavigate } from "react-router";
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
import type { Activity, ActivityDetails } from "@/services/contracts/activity";
import type { ActionAddressPayload } from "@/features/action-edit/types";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { EditAction } from "../EditAction";
import { signIn } from "@/test/auth";
import { makeUser } from "@/test/factories";
import { ACTIVITY_TITLE_MAX_LENGTH } from "@/validators/limits";

const ACTION_ID = "action-1";

const ADDRESS: ActionAddressPayload = {
  addressLine: "Av. Manoel Severino Barbosa, s/n",
  district: "Bom Sucesso",
  zipCode: "57309005",
  city: "Arapiraca",
  state: "AL",
};

type EditableAction = Activity & { details: ActivityDetails };

function editableAction(
  details: Partial<ActivityDetails> = {},
  action: Partial<Activity> = {},
): EditableAction {
  const base = makeActionDetail({ id: ACTION_ID, ...action });

  return {
    ...base,
    details: {
      ...(base.details as ActivityDetails),
      area: "Robótica",
      url: "https://exemplo.com/oficina",
      address: { id: "address-1", ...ADDRESS },
      ...details,
    },
  };
}

function mockAction(action: Activity = editableAction()) {
  // The literal id, not `:id`: an override on `:id` would also answer
  // GET /activities/filters, which the area field calls.
  server.use(
    http.get(`${API}/activities/${ACTION_ID}`, () => HttpResponse.json(action)),
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

function recordDeletes(
  respond: () => Response | Promise<Response> = () =>
    new HttpResponse(null, { status: 204 }),
) {
  const requests: unknown[] = [];
  server.use(
    http.delete(`${API}/activities/${ACTION_ID}`, async () => {
      requests.push(true);
      return respond();
    }),
  );
  return requests;
}

function failUpdate(status: number, body: Record<string, unknown> = {}) {
  server.use(
    http.patch(`${API}/activities/:id`, () =>
      HttpResponse.json(body, { status }),
    ),
  );
}

/** Mounts the session handler the way AppRoutes does, so a 401 reaches /login. */
function SessionExpiry() {
  useSessionExpiry();
  return null;
}

/**
 * The destination routes are part of the tree so a redirect is observed
 * through what ends up on screen, rather than by spying on `useNavigate`.
 */
function renderEditAction() {
  return render(
    <>
      <SessionExpiry />
      <Routes>
        <Route path="/activity/:id/edit" element={<EditAction />} />
        <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        <Route path="/login" element={<h1>Entrar</h1>} />
      </Routes>
    </>,
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

function serveAreas(areas: string[]) {
  server.use(
    http.get(`${API}/activities/filters`, () => HttpResponse.json({ areas })),
  );
}

describe("EditAction", () => {
  it.each([0, 500])(
    "retries a loading failure (%s) and fills the form with the loaded action",
    async (status) => {
      const action = editableAction();
      let calls = 0;
      server.use(
        http.get(`${API}/activities/${ACTION_ID}`, () => {
          calls += 1;
          if (calls > 1) return HttpResponse.json(action);
          return status === 0
            ? HttpResponse.error()
            : new HttpResponse(null, { status });
        }),
      );
      const { user } = renderEditAction();
      const message =
        "Não foi possível carregar a ação. Verifique sua conexão e tente novamente.";

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(
        screen.queryByText("Ação não encontrada."),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(await findTitleField()).toHaveValue(action.title);
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(calls).toBe(2);
    },
  );

  it("lets the session handler redirect to login when loading answers 401", async () => {
    server.use(
      http.get(
        `${API}/activities/${ACTION_ID}`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    renderEditAction();
    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
  });

  it("shows loading during a retry and not found if the action was removed", async () => {
    let calls = 0;
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}`, async () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error();
        await responseReady;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const { user } = renderEditAction();
    await user.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    release();
    expect(await screen.findByText("Ação não encontrada.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it("loads the action from the API into the form", async () => {
    const action = mockAction();

    renderEditAction();

    expect(await findTitleField()).toHaveValue(action.title);
    expect(screen.getByLabelText("Descrição")).toHaveValue(
      action.details!.description,
    );
    expect(screen.getByLabelText("Número de vagas")).toHaveValue(action.slots);
    expect(screen.getByLabelText("Carga horária")).toHaveValue(20);
    expect(screen.getByLabelText("Tipo da ação")).toHaveValue("COURSE");
    expect(screen.getByLabelText("Formato da ação")).toHaveValue("IN_PERSON");
    expect(screen.getByLabelText("Área de atuação")).toHaveValue("Robótica");
    expect(screen.getByLabelText("Campus")).toHaveValue("ARAPIRACA");
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

  it("offers the type, format and campus vocabulary closed in #171", async () => {
    mockAction();

    renderEditAction();

    await findTitleField();

    expect(optionLabels(screen.getByLabelText("Tipo da ação"))).toEqual([
      "Ação de extensão",
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

    const slots = await screen.findByLabelText("Número de vagas");
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

  it("sends the link of an online action when it is edited", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "https://exemplo.com/novo");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        url: "https://exemplo.com/novo",
      }),
    );
  });

  it("does not show the link field for an in-person action", async () => {
    mockAction(editableAction({ format: "IN_PERSON" }));

    renderEditAction();

    await findTitleField();

    expect(screen.queryByLabelText(/link/i)).not.toBeInTheDocument();
  });

  it.each(["ONLINE", "HYBRID"] as const)(
    "shows the saved link of a %s action",
    async (format) => {
      const action = mockAction(editableAction({ format }));

      renderEditAction();

      await findTitleField();

      expect(screen.getByLabelText("Link para o evento")).toHaveValue(
        action.details!.url,
      );
    },
  );

  it("asks for the link of an online action with the create form's message", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    await user.clear(screen.getByLabelText("Link para o evento"));
    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "Informe um link válido. Ele é obrigatório em ações on-line e híbridas.",
      ),
    ).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("blocks an invalid link on an online action", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "nao-e-um-link");
    await user.click(getSaveButton());

    expect(
      await screen.findByText("Informe uma URL válida"),
    ).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("saves an in-person switch even if the hidden link is invalid", async () => {
    mockAction(editableAction({ format: "ONLINE" }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "nao-e-um-link");
    await user.selectOptions(
      screen.getByLabelText("Formato da ação"),
      "IN_PERSON",
    );
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        format: "IN_PERSON",
        address: ADDRESS,
      }),
    );
  });

  it("drops an edited link when the action becomes in-person", async () => {
    mockAction(editableAction({ format: "ONLINE" }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "https://exemplo.com/novo");
    await user.selectOptions(
      screen.getByLabelText("Formato da ação"),
      "IN_PERSON",
    );
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        format: "IN_PERSON",
        address: ADDRESS,
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

    expect(
      await screen.findByText("O CEP deve ter 8 dígitos"),
    ).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("blocks a title over the length limit before any request goes out", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.click(title);
    await user.paste("a".repeat(ACTIVITY_TITLE_MAX_LENGTH + 1));
    await user.click(getSaveButton());

    expect(
      await screen.findByText("O título deve ter no máximo 150 caracteres."),
    ).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  describe("description saved before the length rule", () => {
    it("saves another field without touching the short description", async () => {
      mockAction(editableAction({ description: "Oficina" }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const slots = await screen.findByLabelText("Número de vagas");
      await user.clear(slots);
      await user.type(slots, "45");
      await user.click(getSaveButton());

      await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ slots: 45 }));
      expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
    });

    it("blocks a changed description below the minimum length", async () => {
      mockAction(editableAction({ description: "Oficina" }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();
      const description = screen.getByLabelText("Descrição");
      await user.clear(description);
      await user.type(description, "Oficina 2");
      await user.click(getSaveButton());

      expect(
        await screen.findByText("A descrição deve ter no mínimo 10 caracteres"),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("blocks a cleared description", async () => {
      mockAction(editableAction({ description: "Oficina" }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();
      await user.clear(screen.getByLabelText("Descrição"));
      await user.click(getSaveButton());

      expect(
        await screen.findByText("A descrição é obrigatória"),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  it("keeps an action editable when its area is outside the suggestions", async () => {
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

  it("suggests the areas returned by GET /activities/filters and nothing else", async () => {
    mockAction();
    serveAreas(["Robótica Educacional", "Saúde", "Saude"]);

    renderEditAction();

    await findTitleField();

    await waitFor(() =>
      expect(areaSuggestions()).toEqual([
        "Robótica Educacional",
        "Saúde",
        "Saude",
      ]),
    );
  });

  it("sends a typed area that is not among the suggestions", async () => {
    mockAction();
    serveAreas(["Robótica", "Saúde"]);
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const area = getAreaField();
    await user.clear(area);
    await user.type(area, "Astronomia Amadora");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ area: "Astronomia Amadora" }),
    );
  });

  it("trims the spaces around the area before sending it", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const area = getAreaField();
    await user.clear(area);
    await user.type(area, "  Astronomia Amadora  ");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ area: "Astronomia Amadora" }),
    );
  });

  it("still saves the area when the suggestions fail to load", async () => {
    mockAction();
    server.use(
      http.get(`${API}/activities/filters`, () =>
        HttpResponse.json(
          { message: "Internal server error." },
          { status: 500 },
        ),
      ),
    );
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const area = getAreaField();
    await user.clear(area);
    await user.type(area, "Astronomia Amadora");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ area: "Astronomia Amadora" }),
    );
    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
  });

  describe("date and time", () => {
    // 08:00 and 18:00 in America/Maceio (UTC-3), the timezone tests run in.
    const START = "2026-03-10T11:00:00.000Z";
    const END = "2026-03-17T21:00:00.000Z";

    function mockScheduledAction(startDate = START, endDate = END) {
      return mockAction(editableAction({}, { startDate, endDate }));
    }

    function changeField(label: string, value: string) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }

    it("loads the start and end times of the action", async () => {
      mockScheduledAction();

      renderEditAction();

      await findTitleField();

      expect(screen.getByLabelText("Data de início")).toHaveValue("2026-03-10");
      expect(screen.getByLabelText("Horário de início")).toHaveValue("08:00");
      expect(screen.getByLabelText("Data de encerramento")).toHaveValue(
        "2026-03-17",
      );
      expect(screen.getByLabelText("Horário de encerramento")).toHaveValue(
        "18:00",
      );
    });

    it("keeps the time and sends both ends when only the start date changes", async () => {
      mockScheduledAction();
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Data de início", "2026-03-11");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({
          startDate: "2026-03-11T11:00:00.000Z",
          endDate: END,
        }),
      );
    });

    it("keeps the time and sends both ends when only the end date changes", async () => {
      mockScheduledAction();
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Data de encerramento", "2026-03-18");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({
          startDate: START,
          endDate: "2026-03-18T21:00:00.000Z",
        }),
      );
    });

    it("saves a new time without changing the date", async () => {
      mockScheduledAction();
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Horário de início", "09:30");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({
          startDate: "2026-03-10T12:30:00.000Z",
          endDate: END,
        }),
      );
    });

    it("blocks an end time before the start time on the same date", async () => {
      mockScheduledAction(START, "2026-03-10T21:00:00.000Z");
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Horário de encerramento", "07:00");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(/encerramento deve ser posterior/),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("blocks an end equal to the start, as the create form does", async () => {
      mockScheduledAction(START, "2026-03-10T21:00:00.000Z");
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Horário de encerramento", "08:00");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(/encerramento deve ser posterior/),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
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
    await user.selectOptions(
      screen.getByLabelText("Formato da ação"),
      "ONLINE",
    );
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
    await user.selectOptions(
      screen.getByLabelText("Formato da ação"),
      "ONLINE",
    );
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
      code: "VALIDATION_ERROR",
      errors: [
        {
          field: "slots",
          message: "Arbitrary backend text.",
          code: "BELOW_APPROVED_ENROLLMENTS",
        },
      ],
      details: { approvedEnrollments: 15 },
    });
    const { user } = renderEditAction();

    const slots = await screen.findByLabelText("Número de vagas");
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
      await screen.findByText(
        "Apenas o autor ou gestor pode editar esta ação.",
      ),
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

  it("replaces the edit screen with login on 401 without adding another login entry", async () => {
    mockAction();
    failUpdate(401);

    function LoginScreen() {
      const navigate = useNavigate();
      return (
        <>
          <h1>Entrar</h1>
          <button type="button" onClick={() => navigate(-1)}>
            Voltar
          </button>
        </>
      );
    }

    const { user } = render(
      <>
        <SessionExpiry />
        <Routes>
          <Route
            path="/profile"
            element={<Link to={`/activity/${ACTION_ID}/edit`}>Editar</Link>}
          />
          <Route path="/activity/:id/edit" element={<EditAction />} />
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </>,
      { route: "/profile" },
    );

    await user.click(screen.getByRole("link", { name: "Editar" }));
    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "Título com sessão expirada");
    await user.click(getSaveButton());

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      await screen.findByRole("link", { name: "Editar" }),
    ).toBeInTheDocument();
  });

  it.each([0, 500])(
    "shows a connection failure (%i) and keeps what was typed",
    async (status) => {
      mockAction();
      server.use(
        http.patch(`${API}/activities/:id`, () =>
          status === 0
            ? HttpResponse.error()
            : new HttpResponse(null, { status }),
        ),
      );
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Título preservado após o erro");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "Não foi possível conectar ao servidor. Tente novamente.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Título")).toHaveValue(
        "Título preservado após o erro",
      );
    },
  );

  it("shows the not-found screen when the action does not exist", async () => {
    server.use(
      http.get(
        `${API}/activities/${ACTION_ID}`,
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

  it("goes back to the screen that opened the edit after saving", async () => {
    mockAction();
    spyOnUpdate();

    function BackButton() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate(-1)}>
          Voltar
        </button>
      );
    }

    const { user } = render(
      <Routes>
        <Route
          path="/profile"
          element={<Link to={`/activity/${ACTION_ID}/edit`}>Editar</Link>}
        />
        <Route path="/activity/:id/edit" element={<EditAction />} />
        <Route path="/activity/:id" element={<BackButton />} />
      </Routes>,
      { route: "/profile" },
    );

    await user.click(screen.getByRole("link", { name: "Editar" }));
    const slots = await screen.findByLabelText("Número de vagas");
    await user.clear(slots);
    await user.type(slots, "45");
    await user.click(getSaveButton());
    await user.click(await screen.findByRole("button", { name: "Voltar" }));

    expect(
      await screen.findByRole("link", { name: "Editar" }),
    ).toBeInTheDocument();
  });
});

describe("EditAction deletion", () => {
  it("does not show the delete action button when user is not author nor manager", async () => {
    mockAction(editableAction({}, { authorId: "author-123" }));
    signIn(makeUser({ id: "other-user", isManager: false }));

    renderEditAction();

    await findTitleField();

    expect(
      screen.queryByRole("button", { name: "Excluir ação" }),
    ).not.toBeInTheDocument();
  });

  it("shows delete button and redirects to /dashboard when creator deletes action with 204", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    const requests = recordDeletes();

    const { user } = renderEditAction();

    await findTitleField();

    const deleteBtn = screen.getByRole("button", { name: "Excluir ação" });
    await user.click(deleteBtn);

    expect(
      screen.getByRole("heading", { name: "Confirmar exclusão" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it("allows a manager who is not the author to see delete button and delete action", async () => {
    mockAction(editableAction({}, { authorId: "author-123" }));
    signIn(makeUser({ id: "manager-user", isManager: true }));
    const requests = recordDeletes();

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it("does not send DELETE request when user cancels the deletion modal", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    const requests = recordDeletes();

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Não" }));

    expect(
      screen.queryByRole("heading", { name: "Confirmar exclusão" }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
  });

  it("redirects to /dashboard silently on 404 response without system error", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    recordDeletes(() =>
      HttpResponse.json({ message: "Not found" }, { status: 404 }),
    );

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("shows pt-BR error message in modal when deletion responds with 403", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    recordDeletes(() =>
      HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
    );

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(
      await screen.findByText("Você não tem permissão para excluir esta ação."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("redirects to /login when deletion responds with 401", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    recordDeletes(() =>
      HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
    );

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument();
  });

  it("does not send multiple DELETE requests on double clicking confirm", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    const requests = recordDeletes();

    const { user } = renderEditAction();

    await findTitleField();

    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.dblClick(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => expect(requests).toHaveLength(1));
  });
});
