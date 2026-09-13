import { describe, expect, it, vi } from "vitest";
import {
  API,
  HttpResponse,
  http,
  makeSigaaActivity,
  render,
  screen,
  server,
  waitFor,
  within,
} from "@/test";
import { SigaaFeed } from "../SigaaFeed";

function listResponse(
  items: ReturnType<typeof makeSigaaActivity>[],
  overrides: { total?: number; page?: number; limit?: number } = {},
) {
  return HttpResponse.json({
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 10,
  });
}

function renderFeed(onExploreHelpa = vi.fn()) {
  // debounceMs 0 keeps fake timers out of the component tests; the debounce
  // itself is covered in useDebouncedValue.test.ts.
  return {
    onExploreHelpa,
    ...render(<SigaaFeed onExploreHelpa={onExploreHelpa} debounceMs={0} />),
  };
}

describe("SigaaFeed", () => {
  it("renders the activities returned by the API", async () => {
    server.use(
      http.get(`${API}/sigaa-activities`, () =>
        listResponse([
          makeSigaaActivity({
            title: "Recital Didático",
            type: "EVENTO",
            department: "Escola de Música",
          }),
        ]),
      ),
    );

    renderFeed();

    expect(
      await screen.findByRole("heading", { name: "Recital Didático" }),
    ).toBeInTheDocument();

    // Scoped to the row: "EVENTO" is also an <option> in the type filter.
    const row = within(screen.getByRole("listitem"));
    expect(row.getByText("EVENTO")).toBeInTheDocument();
    expect(row.getByText("Escola de Música")).toBeInTheDocument();
  });

  it("shows its own empty state instead of a blank screen", async () => {
    server.use(
      http.get(`${API}/sigaa-activities`, () => listResponse([], { total: 0 })),
    );

    renderFeed();

    expect(
      await screen.findByText("Nenhuma ação do SIGAA encontrada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar de novo" }),
    ).not.toBeInTheDocument();
  });

  it("offers a retry on failure and refetches when it is used", async () => {
    let attempts = 0;

    server.use(
      http.get(`${API}/sigaa-activities`, () => {
        attempts += 1;

        return attempts === 1
          ? new HttpResponse(null, { status: 500 })
          : listResponse([makeSigaaActivity({ title: "Recital Didático" })]);
      }),
    );

    const { user } = renderFeed();

    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    expect(
      screen.getByText("Não foi possível carregar as ações do SIGAA"),
    ).toBeInTheDocument();

    await user.click(retry);

    expect(
      await screen.findByRole("heading", { name: "Recital Didático" }),
    ).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("degrades the enrollment notice while the feed is failing", async () => {
    let attempts = 0;

    server.use(
      http.get(`${API}/sigaa-activities`, () => {
        attempts += 1;

        return attempts === 1
          ? new HttpResponse(null, { status: 500 })
          : listResponse([makeSigaaActivity()]);
      }),
    );

    const { user } = renderFeed();

    expect(
      await screen.findByText(/as inscrições das ações do SIGAA são feitas/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/não são inscritas pela plataforma/),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(
      await screen.findByText(/não são inscritas pela plataforma/),
    ).toBeInTheDocument();
  });

  it("keeps the screen alive when the backend rejects the query with a 400", async () => {
    server.use(
      http.get(`${API}/sigaa-activities`, () =>
        HttpResponse.json(
          { errors: [{ field: "order", message: "invalid" }] },
          { status: 400 },
        ),
      ),
    );

    renderFeed();

    expect(
      await screen.findByText("Não foi possível carregar as ações do SIGAA"),
    ).toBeInTheDocument();
  });

  it("disables a filter that has no options, without blocking the list", async () => {
    server.use(
      http.get(`${API}/sigaa-activities/filters`, () =>
        HttpResponse.json({ types: [], departments: [] }),
      ),
    );

    renderFeed();

    expect(
      await screen.findByRole("heading", {
        name: "I Ciclo de Debates sobre Currículos",
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Tipo")).toBeDisabled();
    });
    expect(screen.getByLabelText("Departamento")).toBeDisabled();
    expect(screen.getByLabelText("Ordem")).toBeEnabled();
  });

  it("disables the filters when the options request fails, without blocking the list", async () => {
    server.use(
      http.get(
        `${API}/sigaa-activities/filters`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderFeed();

    expect(
      await screen.findByRole("heading", {
        name: "I Ciclo de Debates sobre Currículos",
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Tipo")).toBeDisabled();
    });
    expect(screen.getByLabelText("Departamento")).toBeDisabled();
  });

  it("restarts on page 1 and sends the chosen filter when it changes", async () => {
    const requests: URL[] = [];

    server.use(
      http.get(`${API}/sigaa-activities`, ({ request }) => {
        requests.push(new URL(request.url));
        return listResponse([makeSigaaActivity()], { total: 40 });
      }),
    );

    const { user } = renderFeed();

    await screen.findByRole("heading", {
      name: "I Ciclo de Debates sobre Currículos",
    });

    await user.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get("page")).toBe("2");
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Tipo")).toBeEnabled();
    });
    await user.selectOptions(screen.getByLabelText("Tipo"), "EVENTO");

    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get("type")).toBe("EVENTO");
    });
    expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  });

  it("never offers enrollment on a SIGAA activity", async () => {
    renderFeed();

    const row = await screen.findByRole("listitem");

    expect(
      within(row).queryByRole("button", { name: /inscre/i }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("link", { name: /inscre/i }),
    ).not.toBeInTheDocument();
    expect(within(row).getAllByRole("link")).toHaveLength(1);
  });

  it("links to the SIGAA permalink built from sigaaId", async () => {
    server.use(
      http.get(`${API}/sigaa-activities`, () =>
        listResponse([makeSigaaActivity({ sigaaId: "13704" })]),
      ),
    );

    renderFeed();

    expect(
      await screen.findByRole("link", { name: /Ver no SIGAA/ }),
    ).toHaveAttribute(
      "href",
      "https://sigaa.sig.ufal.br/sigaa/link/public/extensao/visualizacaoAcaoExtensao/13704",
    );
  });

  it("omits the link when sigaaId is the scraper's hash fallback", async () => {
    server.use(
      http.get(`${API}/sigaa-activities`, () =>
        listResponse([
          makeSigaaActivity({
            title: "Recital Didático",
            sigaaId: "a3f1c0de9b8877aa",
          }),
        ]),
      ),
    );

    renderFeed();

    await screen.findByRole("heading", { name: "Recital Didático" });
    expect(
      screen.queryByRole("link", { name: /Ver no SIGAA/ }),
    ).not.toBeInTheDocument();
  });
});
