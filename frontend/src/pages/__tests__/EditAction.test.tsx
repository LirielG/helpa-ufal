import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  API,
  act,
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
      "17/03/2026",
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

  it("saves a link typed without a scheme with https://", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "www.exemplo.com");
    await user.tab();

    expect(url).toHaveValue("https://www.exemplo.com");

    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        url: "https://www.exemplo.com",
      }),
    );
  });

  it("blocks a link with a scheme other than http or https", async () => {
    mockAction(editableAction({ format: "ONLINE", address: null }));
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    await findTitleField();

    const url = screen.getByLabelText("Link para o evento");
    await user.clear(url);
    await user.type(url, "javascript:alert(1)");
    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "Informe um link válido, como https://meet.google.com/abc-defg-hij.",
      ),
    ).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
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
      await screen.findByText(
        "Informe um link válido, como https://meet.google.com/abc-defg-hij.",
      ),
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

  it.each(["A", "Ab", "  Ab  "])(
    "saves slots while leaving the saved short title %j unchanged",
    async (title) => {
      mockAction(editableAction({}, { title }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const slots = await screen.findByLabelText("Número de vagas");
      await user.clear(slots);
      await user.type(slots, "45");
      await user.click(getSaveButton());

      await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ slots: 45 }));
      expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
    },
  );

  it.each([
    ["", "O título é obrigatório"],
    ["   ", "O título é obrigatório"],
    ["Ab", "O título deve ter no mínimo 3 caracteres"],
    ["  Ab  ", "O título deve ter no mínimo 3 caracteres"],
  ])("blocks an invalid changed title %j", async (value, message) => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    if (value) await user.type(title, value);
    await user.click(getSaveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("sends a changed three-character title without surrounding spaces", async () => {
    mockAction();
    const onUpdate = spyOnUpdate();
    const { user } = renderEditAction();

    const title = await findTitleField();
    await user.clear(title);
    await user.type(title, "  Abc  ");
    await user.click(getSaveButton());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ title: "Abc" }),
    );
    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
  });

  it.each(["B", "Bc", "  Bc  "])(
    "blocks replacing a saved short title with another short title %j",
    async (value) => {
      mockAction(editableAction({}, { title: "Ab" }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, value);
      await user.click(getSaveButton());

      expect(
        await screen.findByText("O título deve ter no mínimo 3 caracteres"),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["   ", "O título é obrigatório"],
    ["a".repeat(151), "O título deve ter no máximo 150 caracteres."],
  ])(
    "blocks an invalid saved title %j even when unchanged",
    async (title, message) => {
      mockAction(editableAction({}, { title }));
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const slots = await screen.findByLabelText("Número de vagas");
      await user.clear(slots);
      await user.type(slots, "45");
      await user.click(getSaveButton());

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    },
  );

  it("uses the saved title of the newly loaded action after the route changes", async () => {
    mockAction(editableAction({}, { title: "Ab" }));
    server.use(
      http.get(`${API}/activities/action-2`, () =>
        HttpResponse.json(editableAction({}, { id: "action-2", title: "Cd" })),
      ),
    );
    const onUpdate = spyOnUpdate();
    const { user } = render(
      <Routes>
        <Route
          path="/activity/:id/edit"
          element={
            <>
              <Link to="/activity/action-2/edit">Editar outra ação</Link>
              <EditAction />
            </>
          }
        />
        <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
      </Routes>,
      { route: `/activity/${ACTION_ID}/edit` },
    );

    expect(await findTitleField()).toHaveValue("Ab");
    await user.click(screen.getByRole("link", { name: "Editar outra ação" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Título")).toHaveValue("Cd"),
    );

    const slots = screen.getByLabelText("Número de vagas");
    await user.clear(slots);
    await user.type(slots, "45");
    await user.click(getSaveButton());

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ slots: 45 }));
    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
  });

  describe("switching to another action without leaving the screen", () => {
    const SECOND_ACTION_ID = "action-2";

    function renderWithLinkToSecondAction() {
      return render(
        <Routes>
          <Route
            path="/activity/:id/edit"
            element={
              <>
                <Link to={`/activity/${SECOND_ACTION_ID}/edit`}>
                  Editar outra ação
                </Link>
                <EditAction />
              </>
            }
          />
          <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
        </Routes>,
        { route: `/activity/${ACTION_ID}/edit` },
      );
    }

    function serveSecondAction(respond: () => Promise<Response> | Response) {
      server.use(http.get(`${API}/activities/${SECOND_ACTION_ID}`, respond));
    }

    function recordUpdates() {
      const updates: { id: string; body: unknown }[] = [];
      server.use(
        http.patch(`${API}/activities/:id`, async ({ params, request }) => {
          updates.push({ id: String(params.id), body: await request.json() });
          return HttpResponse.json(editableAction());
        }),
      );
      return updates;
    }

    it("shows loading and no save button while the new action loads", async () => {
      mockAction(editableAction({}, { title: "Alfa" }));
      serveSecondAction(async () => {
        await delay("infinite");
        return HttpResponse.json(null);
      });
      const updates = recordUpdates();
      const { user } = renderWithLinkToSecondAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Alfa editado");
      await user.click(screen.getByRole("link", { name: "Editar outra ação" }));

      expect(await screen.findByText("Carregando...")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Salvar" }),
      ).not.toBeInTheDocument();
      expect(updates).toEqual([]);
    });

    it("drops the edits of the previous action and sends only what changed in the new one", async () => {
      mockAction(editableAction({}, { title: "Alfa", slots: 10 }));
      serveSecondAction(async () => {
        await delay(50);
        return HttpResponse.json(
          editableAction(
            {},
            { id: SECOND_ACTION_ID, title: "Beta", slots: 20 },
          ),
        );
      });
      const updates = recordUpdates();
      const { user } = renderWithLinkToSecondAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Alfa editado");
      await user.click(screen.getByRole("link", { name: "Editar outra ação" }));

      await waitFor(() =>
        expect(screen.getByLabelText("Título")).toHaveValue("Beta"),
      );
      const slots = screen.getByLabelText("Número de vagas");
      expect(slots).toHaveValue(20);
      await user.clear(slots);
      await user.type(slots, "45");
      await user.click(getSaveButton());

      expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
      expect(updates).toEqual([{ id: SECOND_ACTION_ID, body: { slots: 45 } }]);
    });

    it("shows the form of the new action when the previous one failed to load", async () => {
      server.use(
        http.get(
          `${API}/activities/${ACTION_ID}`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      );
      serveSecondAction(() =>
        HttpResponse.json(
          editableAction({}, { id: SECOND_ACTION_ID, title: "Beta" }),
        ),
      );
      const { user } = renderWithLinkToSecondAction();
      const message =
        "Não foi possível carregar a ação. Verifique sua conexão e tente novamente.";

      expect(await screen.findByText(message)).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "Editar outra ação" }));

      expect(await findTitleField()).toHaveValue("Beta");
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });
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

  describe("link saved before the http/https rule", () => {
    it("saves another field without touching the old link", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "ftp://files.ufal.br/x",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Novo título");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({ title: "Novo título" }),
      );
      expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
    });

    it("leaves an old link without slashes as it is when the field only gets focus", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "mailto:contato@ufal.br",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Novo título");

      const url = screen.getByLabelText("Link para o evento");
      await user.click(url);
      await user.tab();
      expect(url).toHaveValue("mailto:contato@ufal.br");

      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({ title: "Novo título" }),
      );
    });

    it("does not send an old link that was edited and then restored", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "mailto:contato@ufal.br",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Novo título");

      const url = screen.getByLabelText("Link para o evento");
      await user.type(url, "x");
      await user.tab();
      expect(url).toHaveValue("https://mailto:contato@ufal.brx");
      await user.clear(url);
      await user.type(url, "mailto:contato@ufal.br");
      await user.tab();
      expect(url).toHaveValue("mailto:contato@ufal.br");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({ title: "Novo título" }),
      );
    });

    it("blocks an old link left with the https:// the field added", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "mailto:contato@ufal.br",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();
      const url = screen.getByLabelText("Link para o evento");
      await user.type(url, "x");
      await user.tab();
      await user.type(url, "{Backspace}");
      expect(url).toHaveValue("https://mailto:contato@ufal.br");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "Informe um link válido, como https://meet.google.com/abc-defg-hij.",
        ),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("sends an old link completed with https://", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "meet.google.com:443/x",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();
      const url = screen.getByLabelText("Link para o evento");
      await user.clear(url);
      await user.type(url, "https://meet.google.com:443/x");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({
          url: "https://meet.google.com:443/x",
        }),
      );
    });

    it("blocks an old link changed to another invalid one", async () => {
      mockAction(
        editableAction({
          format: "ONLINE",
          address: null,
          url: "ftp://files.ufal.br/x",
        }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();
      const url = screen.getByLabelText("Link para o evento");
      await user.clear(url);
      await user.type(url, "ftp://outro");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "Informe um link válido, como https://meet.google.com/abc-defg-hij.",
        ),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("saves another field of an online action that has no link", async () => {
      mockAction(
        editableAction({ format: "ONLINE", address: null, url: null }),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      const title = await findTitleField();
      await user.clear(title);
      await user.type(title, "Novo título");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({ title: "Novo título" }),
      );
    });

    it.each([
      ["IN_PERSON", "ONLINE"],
      ["IN_PERSON", "HYBRID"],
      ["ONLINE", "HYBRID"],
    ] as const)(
      "still checks the old link when the format goes from %s to %s",
      async (savedFormat, format) => {
        mockAction(
          editableAction({
            format: savedFormat,
            url: "ftp://files.ufal.br/x",
          }),
        );
        const onUpdate = spyOnUpdate();
        const { user } = renderEditAction();

        await findTitleField();
        await user.selectOptions(
          screen.getByLabelText("Formato da ação"),
          format,
        );
        await user.click(getSaveButton());

        expect(
          await screen.findByText(
            "Informe um link válido, como https://meet.google.com/abc-defg-hij.",
          ),
        ).toBeInTheDocument();
        expect(onUpdate).not.toHaveBeenCalled();
      },
    );
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

      expect(screen.getByLabelText("Data de início")).toHaveValue("10/03/2026");
      expect(screen.getByLabelText("Horário de início")).toHaveValue("08:00");
      expect(screen.getByLabelText("Data de encerramento")).toHaveValue(
        "17/03/2026",
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

      changeField("Data de início", "11/03/2026");
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

      changeField("Data de encerramento", "18/03/2026");
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

    it("blocks workload above the action duration and shows the hour limit", async () => {
      mockScheduledAction(START, "2026-03-10T21:00:00.000Z");
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Horário de início", "08:00");
      changeField("Horário de encerramento", "12:00");
      changeField("Carga horária", "5");
      await user.click(getSaveButton());

      expect(
        await screen.findByText(
          "A carga horária não pode passar da duração da ação (4 h).",
        ),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("accepts workload equal to the exact duration", async () => {
      mockScheduledAction(START, "2026-03-10T21:00:00.000Z");
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      changeField("Horário de início", "08:00");
      changeField("Horário de encerramento", "12:00");
      changeField("Carga horária", "4");
      await user.click(getSaveButton());

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ workloadHours: 4 }),
        ),
      );
    });
  });

  describe("time validation", () => {
    it.each([
      ["Horário de início", "8:3"],
      ["Horário de início", "25:70"],
      ["Horário de encerramento", "8:3"],
      ["Horário de encerramento", "25:70"],
    ])("blocks %s %s", async (label, value) => {
      mockAction(
        editableAction(
          {},
          {
            startDate: "2026-03-10T11:00:00.000Z",
            endDate: "2026-03-17T21:00:00.000Z",
          },
        ),
      );
      const onUpdate = spyOnUpdate();
      const { user } = renderEditAction();

      await findTitleField();

      const field = screen.getByLabelText(label);
      await user.clear(field);
      await user.type(field, value);
      await user.click(getSaveButton());

      expect(
        await screen.findByText("Informe um horário válido (hh:mm)."),
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

  it("translates the slots error when the API answers 422", async () => {
    mockAction();
    failUpdate(422, {
      status: 422,
      message:
        "slots cannot be reduced below the current number of approved enrollments (15).",
      code: "SLOTS_BELOW_APPROVED_ENROLLMENTS",
      errors: [
        {
          field: "slots",
          message:
            "slots cannot be reduced below the current number of approved enrollments (15).",
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

describe("EditAction leaving the screen with a request pending", () => {
  let leaveTo: (path: string) => void = () => {};

  function NavigationProbe() {
    const navigate = useNavigate();
    useEffect(() => {
      leaveTo = (path) => navigate(path);
    }, [navigate]);
    return <div data-testid="location">{useLocation().pathname}</div>;
  }

  function renderLeavableEditAction() {
    return render(
      <>
        <NavigationProbe />
        <Routes>
          <Route path="/activity/:id/edit" element={<EditAction />} />
          <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/outra-tela" element={<h1>Outra tela</h1>} />
        </Routes>
      </>,
      { route: `/activity/${ACTION_ID}/edit` },
    );
  }

  /** A response the test releases after it has left the screen. */
  function heldResponse() {
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { released, release };
  }

  async function leaveScreen() {
    act(() => leaveTo("/outra-tela"));
    expect(
      await screen.findByRole("heading", { name: "Outra tela" }),
    ).toBeInTheDocument();
  }

  async function startSave(user: ReturnType<typeof render>["user"]) {
    await findTitleField();
    const slots = screen.getByLabelText("Número de vagas");
    await user.clear(slots);
    await user.type(slots, "45");
    await user.click(getSaveButton());
  }

  async function startDelete(user: ReturnType<typeof render>["user"]) {
    await findTitleField();
    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));
  }

  it("stays on the current route when a save finishes after the user left", async () => {
    mockAction();
    const { released, release } = heldResponse();
    const onUpdate = spyOnUpdate(() => released);
    const { user } = renderLeavableEditAction();

    await startSave(user);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    await leaveScreen();
    release();

    await delay(50);
    expect(screen.getByTestId("location")).toHaveTextContent("/outra-tela");
    expect(screen.queryByText("Detalhe da ação")).not.toBeInTheDocument();
  });

  it("stays on the current route and still confirms when a deletion finishes after the user left", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    const { released, release } = heldResponse();
    const requests = recordDeletes(async () => {
      await released;
      return new HttpResponse(null, { status: 204 });
    });
    const { user } = renderLeavableEditAction();

    await startDelete(user);
    await waitFor(() => expect(requests).toHaveLength(1));
    await leaveScreen();
    release();

    expect(await screen.findByText("Ação excluída.")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/outra-tela");
  });

  it("shows a save error that arrives after the user left as a toast", async () => {
    mockAction();
    const { released, release } = heldResponse();
    server.use(
      http.patch(`${API}/activities/:id`, async () => {
        await released;
        return HttpResponse.json({ message: "Conflict" }, { status: 409 });
      }),
    );
    const { user } = renderLeavableEditAction();

    await startSave(user);
    await leaveScreen();
    release();

    expect(
      await screen.findByText(
        "Ações concluídas ou canceladas não podem ser editadas.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/outra-tela");
  });

  it("shows a field validation error that arrives after the user left as a generic toast", async () => {
    mockAction();
    const { released, release } = heldResponse();
    server.use(
      http.patch(`${API}/activities/:id`, async () => {
        await released;
        return HttpResponse.json(
          {
            message: "Validation failed",
            errors: [{ field: "slots", message: "Invalid" }],
          },
          { status: 400 },
        );
      }),
    );
    const { user } = renderLeavableEditAction();

    await startSave(user);
    await leaveScreen();
    release();

    expect(
      await screen.findByText(
        "Ocorreu um erro ao atualizar a ação. Tente novamente.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a deletion error that arrives after the user left as a toast", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    const { released, release } = heldResponse();
    recordDeletes(async () => {
      await released;
      return HttpResponse.json({ message: "Forbidden" }, { status: 403 });
    });
    const { user } = renderLeavableEditAction();

    await startDelete(user);
    await leaveScreen();
    release();

    expect(
      await screen.findByText("Você não tem permissão para excluir esta ação."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/outra-tela");
  });
});

describe("EditAction of an action removed by moderation", () => {
  const REMOVED_MESSAGE = "Esta ação foi removida pela moderação.";
  const removedBody = {
    status: 410,
    code: "ACTIVITY_REMOVED",
    message: "This activity was removed by moderation.",
  };

  it("shows the toast and goes to the detail when saving answers 410", async () => {
    mockAction();
    failUpdate(410, removedBody);
    const { user } = renderEditAction();

    await findTitleField();
    const slots = screen.getByLabelText("Número de vagas");
    await user.clear(slots);
    await user.type(slots, "45");
    await user.click(getSaveButton());

    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
    expect(await screen.findByText(REMOVED_MESSAGE)).toBeInTheDocument();
  });

  it("shows the toast and goes to the detail when deleting answers 410", async () => {
    mockAction(editableAction({}, { authorId: "user-123" }));
    signIn(makeUser({ id: "user-123", isManager: false }));
    recordDeletes(() => HttpResponse.json(removedBody, { status: 410 }));
    const { user } = renderEditAction();

    await findTitleField();
    await user.click(screen.getByRole("button", { name: "Excluir ação" }));
    await user.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText("Detalhe da ação")).toBeInTheDocument();
    expect(await screen.findByText(REMOVED_MESSAGE)).toBeInTheDocument();
  });
});
